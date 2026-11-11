import os
import json
import time
import uuid
import tempfile
from datetime import datetime

BUNDLED_HISTORY_FILE = os.path.join(os.path.dirname(__file__), 'static', 'history', 'history.json')
TEMP_HISTORY_FILE = os.path.join(tempfile.gettempdir(), 'msg_oilfield_history.json')

def _is_local_writable():
    local_dir = os.path.join(os.path.dirname(__file__), 'static', 'history')
    try:
        os.makedirs(local_dir, exist_ok=True)
        test_file = os.path.join(local_dir, '.write_test')
        with open(test_file, 'w') as f:
            f.write('1')
        if os.path.exists(test_file):
            os.remove(test_file)
        return True
    except Exception:
        return False

def _get_history_file(for_writing=False):
    """
    Determines history file path.
    If local directory is writable (local development), uses static/history/history.json.
    Otherwise (e.g. Vercel serverless /var/task), falls back to /tmp/msg_oilfield_history.json.
    """
    if _is_local_writable():
        return BUNDLED_HISTORY_FILE
    
    if for_writing or os.path.exists(TEMP_HISTORY_FILE):
        return TEMP_HISTORY_FILE
        
    if os.path.exists(BUNDLED_HISTORY_FILE):
        return BUNDLED_HISTORY_FILE
        
    return TEMP_HISTORY_FILE

def _ensure_history_file():
    target_file = _get_history_file(for_writing=True)
    try:
        os.makedirs(os.path.dirname(target_file), exist_ok=True)
    except Exception:
        pass
        
    if not os.path.exists(target_file):
        initial_data = []
        if os.path.exists(BUNDLED_HISTORY_FILE):
            try:
                with open(BUNDLED_HISTORY_FILE, 'r', encoding='utf-8') as f:
                    initial_data = json.load(f)
            except Exception:
                initial_data = []
        try:
            with open(target_file, 'w', encoding='utf-8') as f:
                json.dump(initial_data, f)
        except Exception as e:
            print(f"Warning: Could not create history file: {e}")
            
    return target_file

def get_all_sheets(search_query=""):
    """
    Returns unlimited historical worksheet records, sorted newest first.
    Filters by search_query (Client Name, PO Number, MSG Ref, Date, Item Keywords).
    """
    target_file = _get_history_file(for_writing=False)
    sheets = []
    
    if os.path.exists(target_file):
        try:
            with open(target_file, 'r', encoding='utf-8') as f:
                sheets = json.load(f)
        except Exception:
            sheets = []

    if not sheets and os.path.exists(BUNDLED_HISTORY_FILE) and target_file != BUNDLED_HISTORY_FILE:
        try:
            with open(BUNDLED_HISTORY_FILE, 'r', encoding='utf-8') as f:
                sheets = json.load(f)
        except Exception:
            pass

    # Sort newest first
    sheets.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

    if not search_query or not search_query.strip():
        return sheets

    q = search_query.strip().lower()

    filtered = []
    for s in sheets:
        client = str(s.get('client', '')).lower()
        po = str(s.get('po_number', '')).lower()
        msg_ref = str(s.get('msg_ref', '')).lower()
        timestamp = str(s.get('formatted_date', '')).lower()
        
        editor = str(s.get('editor_username', '')).lower()
        
        # Search inside items text as well (description, remarks, make, supplier, po, etc.)
        item_text = " ".join(
            f"{it.get('description', '')} {it.get('remarks', '')} {it.get('make', '')} {it.get('supplier_name', '')} {it.get('supplier_po', '')} {it.get('client_po_item_no', '')}"
            for it in s.get('items', [])
        ).lower()

        if q in client or q in po or q in msg_ref or q in timestamp or q in editor or q in item_text:
            filtered.append(s)

    return filtered

def get_sheet_by_id(sheet_id):
    """
    Retrieves a single saved worksheet record by unique ID.
    """
    sheets = get_all_sheets()
    for s in sheets:
        if s.get('id') == sheet_id:
            return s
    return None

def save_sheet_snapshot(data, file_urls=None, editor_username="Admin"):
    """
    Saves or updates a worksheet state snapshot in the history database.
    data: JSON payload with client, po_number, msg_ref, items, filter_machined_only, editor_username
    file_urls: dict with client_excel_url, stores_excel_url, cipl_excel_url, supplier_pdf_zip_url
    """
    target_file = _ensure_history_file()
    sheets = get_all_sheets()

    msg_ref = data.get("msg_ref", "SO").strip()
    po_number = data.get("po_number", "").strip()
    client = data.get("client", "").strip()
    items = data.get("items", [])
    author = data.get("editor_username") or editor_username or "Admin"

    # Create unique ID if not present or if save_as_new_draft is requested
    existing_id = data.get("id")
    save_new = bool(data.get("save_as_new_draft", False))

    if existing_id and not save_new:
        sheet_id = existing_id
    else:
        sheet_id = f"draft_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    formatted_date = datetime.now().strftime('%d %b %Y, %I:%M %p')

    # Preserve existing file URLs if not updated in this call
    existing_record = get_sheet_by_id(sheet_id) if existing_id else None
    merged_urls = existing_record.get('file_urls', {}) if existing_record else {}
    if file_urls:
        merged_urls.update(file_urls)

    record = {
        "id": sheet_id,
        "timestamp": datetime.now().isoformat(),
        "formatted_date": formatted_date,
        "client": client,
        "po_number": po_number,
        "msg_ref": msg_ref,
        "editor_username": author,
        "item_count": len(items),
        "filter_machined_only": bool(data.get("filter_machined_only", True)),
        "items": items,
        "file_urls": merged_urls
    }

    # Remove existing record if updating same ID
    sheets = [s for s in sheets if s.get('id') != sheet_id]
    sheets.insert(0, record)

    try:
        with open(target_file, 'w', encoding='utf-8') as f:
            json.dump(sheets, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save history file: {e}")

    return record

def delete_sheet_snapshot(sheet_id):
    """
    Deletes a historical sheet record by ID.
    """
    target_file = _ensure_history_file()
    sheets = get_all_sheets()
    filtered = [s for s in sheets if s.get('id') != sheet_id]
    try:
        with open(target_file, 'w', encoding='utf-8') as f:
            json.dump(filtered, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not delete history record: {e}")
    return True
