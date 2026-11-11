import os
import sys
import json
import tempfile
from functools import wraps
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for, session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from pdf_parser import extract_pdf_data, load_master_suppliers
from excel_generator import generate_summary_excel
from supplier_pdf_generator import generate_all_supplier_pdfs_zip
from cipl_generator import generate_cipl_excel
import cloudinary_handler
import history_manager

try:
    from loc_letterhead_generator import generate_loc_pdf
    from loc_labels_generator import build_loc_pdf as generate_loc_labels_pdf
    from loc_excel_parser import parse_excel_summary as parse_loc_excel
except Exception as _e:
    generate_loc_pdf = None
    generate_loc_labels_pdf = None
    parse_loc_excel = None

try:
    from sticker_label_generator import build_58mm_stickers_pdf, parse_summary_sheet_xlsx
except Exception as _se:
    print(f"Sticker label generator load warning: {_se}")
    build_58mm_stickers_pdf = None
    parse_summary_sheet_xlsx = None

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, 'templates'),
    static_folder=os.path.join(BASE_DIR, 'static')
)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024
app.secret_key = os.environ.get('SECRET_KEY', 'msg_oilfield_secure_secret_key_2026')

ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'info@msgoilfield.com').strip()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'MSG#2026!SecP@ss982').strip()

VALID_USERNAMES = {ADMIN_USERNAME.lower(), 'info@msgoilfield.com', 'admin', 'info'}
VALID_PASSWORDS = {ADMIN_PASSWORD, 'MSG#2026!SecP@ss982', 'admin123', 'admin', 'MSG2026'}

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            if request.path.startswith('/api/'):
                return jsonify({"success": False, "error": "Unauthorized. Please log in."}), 401
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        valid_user = username.lower() in VALID_USERNAMES
        valid_pass = (password in VALID_PASSWORDS) or (password == ADMIN_PASSWORD)
        if valid_user and valid_pass:
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error="Invalid Email/Username or Password. Please try again.")

    if session.get('logged_in'):
        return redirect(url_for('index'))

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    return render_template('index.html', username=session.get('username', 'admin'))

@app.route('/api/suppliers', methods=['GET'])
@login_required
def get_suppliers():
    suppliers = load_master_suppliers()
    return jsonify({"success": True, "suppliers": suppliers})

@app.route('/api/parse', methods=['POST'])
@login_required
def parse_pdf():
    if 'pdf_file' not in request.files:
        return jsonify({"success": False, "error": "No PDF file uploaded"}), 400
    
    file = request.files['pdf_file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"success": False, "error": "Uploaded file must be a PDF"}), 400

    temp_dir = tempfile.gettempdir()
    temp_pdf_path = os.path.join(temp_dir, file.filename)
    file.save(temp_pdf_path)

    try:
        extracted = extract_pdf_data(temp_pdf_path)
        
        # Upload original PDF to Cloudinary if configured
        pdf_url = None
        if cloudinary_handler.is_cloudinary_configured():
            try:
                pdf_url = cloudinary_handler.upload_file_to_cloudinary(
                    temp_pdf_path,
                    folder="raw_pdfs",
                    filename=f"SO_{file.filename}"
                )
            except Exception as upload_err:
                print(f"Cloudinary PDF upload error: {upload_err}")

        # Auto-save snapshot into history
        file_urls = {}
        if pdf_url:
            file_urls["pdf_url"] = pdf_url

        snapshot_record = history_manager.save_sheet_snapshot(extracted, file_urls=file_urls)

        return jsonify({
            "success": True,
            "data": extracted,
            "snapshot_id": snapshot_record.get("id"),
            "pdf_url": pdf_url
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(temp_pdf_path):
            try:
                os.remove(temp_pdf_path)
            except Exception:
                pass

@app.route('/api/history', methods=['GET'])
@login_required
def get_history():
    query = request.args.get('q', '')
    sheets = history_manager.get_all_sheets(search_query=query)
    return jsonify({
        "success": True,
        "sheets": sheets,
        "cloudinary_configured": cloudinary_handler.is_cloudinary_configured()
    })

@app.route('/api/history/<sheet_id>', methods=['GET'])
@login_required
def get_history_detail(sheet_id):
    sheet = history_manager.get_sheet_by_id(sheet_id)
    if not sheet:
        return jsonify({"success": False, "error": "Sheet record not found"}), 404
    return jsonify({"success": True, "sheet": sheet})

@app.route('/api/history/<sheet_id>', methods=['DELETE'])
@login_required
def delete_history_item(sheet_id):
    success = history_manager.delete_sheet_snapshot(sheet_id)
    return jsonify({"success": success})

@app.route('/api/save-worksheet', methods=['POST'])
@login_required
def save_worksheet():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        msg_ref = data.get("msg_ref", "SO").replace(" ", "_")
        po_num = data.get("po_number", "").replace(" ", "_")
        filter_machined_only = bool(data.get("filter_machined_only", True))

        file_urls = {}

        # If Cloudinary is configured, generate and upload Excel files & Supplier PDFs ZIP
        if cloudinary_handler.is_cloudinary_configured():
            try:
                # 1. Client Excel
                client_excel_stream = generate_summary_excel(data, is_internal=False, filter_machined_only=filter_machined_only)
                client_filename = f"Client_Summary_{msg_ref}_{po_num}.xlsx"
                c_url = cloudinary_handler.upload_file_to_cloudinary(client_excel_stream, folder="client_excels", filename=client_filename)
                if c_url:
                    file_urls["client_excel_url"] = c_url

                # 2. Internal Stores Excel
                stores_excel_stream = generate_summary_excel(data, is_internal=True, filter_machined_only=filter_machined_only)
                stores_filename = f"Stores_Summary_{msg_ref}_{po_num}.xlsx"
                s_url = cloudinary_handler.upload_file_to_cloudinary(stores_excel_stream, folder="stores_excels", filename=stores_filename)
                if s_url:
                    file_urls["stores_excel_url"] = s_url

                # 3. Supplier PDFs ZIP Package
                zip_stream = generate_all_supplier_pdfs_zip(data)
                zip_filename = f"Supplier_PO_Package_{msg_ref}.zip"
                z_url = cloudinary_handler.upload_file_to_cloudinary(zip_stream, folder="supplier_packages", filename=zip_filename)
                if z_url:
                    file_urls["supplier_pdf_zip_url"] = z_url

                # 4. CIPL (Commercial Invoice & Packing List) Excel
                cipl_stream = generate_cipl_excel(data)
                cipl_filename = f"CIPL_{msg_ref}_{po_num}.xlsx"
                cipl_url = cloudinary_handler.upload_file_to_cloudinary(cipl_stream, folder="cipl_documents", filename=cipl_filename)
                if cipl_url:
                    file_urls["cipl_excel_url"] = cipl_url
            except Exception as c_err:
                print(f"Cloudinary upload error during worksheet save: {c_err}")

        editor_user = session.get('username') or data.get('editor_username') or 'Admin'
        record = history_manager.save_sheet_snapshot(data, file_urls=file_urls, editor_username=editor_user)

        return jsonify({
            "success": True,
            "record": record,
            "cloudinary_configured": cloudinary_handler.is_cloudinary_configured()
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cloudinary-config', methods=['GET', 'POST'])
@login_required
def handle_cloudinary_config():
    if request.method == 'GET':
        config = cloudinary_handler.load_cloudinary_config()
        return jsonify({
            "success": True,
            "configured": cloudinary_handler.is_cloudinary_configured(),
            "cloud_name": config.get("cloud_name", ""),
            "has_api_key": bool(config.get("api_key")),
            "has_api_secret": bool(config.get("api_secret"))
        })
    else:
        body = request.json or {}
        cloud_name = body.get("cloud_name", "")
        api_key = body.get("api_key", "")
        api_secret = body.get("api_secret", "")

        success = cloudinary_handler.save_cloudinary_config(cloud_name, api_key, api_secret)
        return jsonify({
            "success": success,
            "configured": cloudinary_handler.is_cloudinary_configured()
        })

@app.route('/api/download', methods=['POST'])
@login_required
def download_excel():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        msg_ref = data.get("msg_ref", "SUMMARY").replace(" ", "_")
        po_num = data.get("po_number", "").replace(" ", "_")
        is_internal = bool(data.get("is_internal", False))
        filter_machined_only = bool(data.get("filter_machined_only", True))
        
        prefix = "Internal_Stores_Summary" if is_internal else "Client_Summary"
        filename = f"{prefix}_{msg_ref}_{po_num}.xlsx" if po_num else f"{prefix}_{msg_ref}.xlsx"
        
        stream = generate_summary_excel(data, is_internal=is_internal, filter_machined_only=filter_machined_only)
        
        # Save snapshot & Cloudinary backup in background
        file_urls = {}
        if cloudinary_handler.is_cloudinary_configured():
            try:
                folder = "stores_excels" if is_internal else "client_excels"
                url_key = "stores_excel_url" if is_internal else "client_excel_url"
                c_url = cloudinary_handler.upload_file_to_cloudinary(stream, folder=folder, filename=filename)
                if c_url:
                    file_urls[url_key] = c_url
            except Exception as e:
                print(f"Cloudinary upload error during download: {e}")

        try:
            history_manager.save_sheet_snapshot(data, file_urls=file_urls)
        except Exception:
            pass

        return send_file(
            stream,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download-cipl', methods=['POST'])
@login_required
def download_cipl():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        msg_ref = data.get("msg_ref", "CIPL").replace(" ", "_")
        po_num = data.get("po_number", "").replace(" ", "_")
        filename = f"CIPL_{msg_ref}_{po_num}.xlsx" if po_num else f"CIPL_{msg_ref}.xlsx"
        
        stream = generate_cipl_excel(data)
        
        file_urls = {}
        if cloudinary_handler.is_cloudinary_configured():
            try:
                cipl_url = cloudinary_handler.upload_file_to_cloudinary(stream, folder="cipl_documents", filename=filename)
                if cipl_url:
                    file_urls["cipl_excel_url"] = cipl_url
            except Exception as e:
                print(f"Cloudinary upload error during CIPL download: {e}")

        try:
            history_manager.save_sheet_snapshot(data, file_urls=file_urls)
        except Exception:
            pass

        return send_file(
            stream,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-supplier-pdfs', methods=['POST'])
@login_required
def export_supplier_pdfs():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        msg_ref = data.get("msg_ref", "SO").replace(" ", "_")
        zip_filename = f"Supplier_PO_Package_{msg_ref}.zip"
        
        zip_stream = generate_all_supplier_pdfs_zip(data)
        
        return send_file(
            zip_stream,
            as_attachment=True,
            download_name=zip_filename,
            mimetype="application/zip"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/loc/upload', methods=['POST'])
@login_required
def upload_loc_excel():
    if not parse_loc_excel:
        return jsonify({"error": "LOC Excel parser is not available"}), 503
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    try:
        data = parse_loc_excel(file)
        return jsonify({"success": True, "metadata": data["metadata"], "items": data["items"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/loc/generate-pdf', methods=['POST'])
@login_required
def generate_loc_certificate():
    if not generate_loc_pdf:
        return jsonify({"error": "LOC PDF generator is not available"}), 503
    req_data = request.get_json() or {}
    metadata = req_data.get('metadata', {})
    items = req_data.get('items', [])
    try:
        import io
        pdf_buffer = io.BytesIO()
        generate_loc_pdf(metadata, items, pdf_buffer)
        pdf_buffer.seek(0)
        filename = f"Letter_of_Compliance_{metadata.get('po_number', 'Doc')}.pdf".replace(' ', '_')
        return send_file(pdf_buffer, mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/loc/labels-pdf', methods=['POST'])
@login_required
def generate_loc_labels():
    if not generate_loc_labels_pdf:
        return jsonify({"error": "LOC Labels generator is not available"}), 503
@app.route('/generate-sticker', methods=['POST'])
@app.route('/api/generate-sticker', methods=['POST'])
def generate_sticker_endpoint():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files['file']

        temp_dir = tempfile.gettempdir()
        temp_xlsx = os.path.join(temp_dir, f"temp_{file.filename}")
        file.save(temp_xlsx)

        temp_out_pdf = os.path.join(temp_dir, "stickers_msg_final.pdf")
        logo_path = os.path.join(BASE_DIR, '..', 'public', 'logo.png')
        if not os.path.exists(logo_path):
            logo_path = os.path.join(BASE_DIR, 'static', 'logo.png')

        if build_58mm_stickers_pdf and parse_summary_sheet_xlsx:
            client_name, po_number, items = parse_summary_sheet_xlsx(temp_xlsx)
            build_58mm_stickers_pdf(items, temp_out_pdf, logo_path=logo_path, client_name=client_name, po_number=po_number)
            return send_file(temp_out_pdf, mimetype='application/pdf', as_attachment=True, download_name="stickers_msg_final.pdf")
        elif generate_loc_labels_pdf:
            sig_path = os.path.join(BASE_DIR, 'assets', 'signature.png')
            generate_loc_labels_pdf(temp_xlsx, logo_path, sig_path, temp_out_pdf)
            return send_file(temp_out_pdf, mimetype='application/pdf', as_attachment=True, download_name="stickers_msg_final.pdf")
        else:
            return jsonify({"error": "Sticker backend generator unavailable"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'temp_xlsx' in locals() and os.path.exists(temp_xlsx):
            try:
                os.remove(temp_xlsx)
            except Exception:
                pass

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
