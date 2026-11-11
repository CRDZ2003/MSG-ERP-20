import os
import openpyxl
from reportlab.lib.pagesizes import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

# Exact 58mm x 39mm
PAGE_WIDTH = 58 * mm   # 164.4094 pt
PAGE_HEIGHT = 39 * mm  # 110.5512 pt

def parse_summary_sheet_xlsx(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active

    client_name = "STS Bahrain"
    po_number = "BSTSPO260300029-Location-1"
    msg_ref = "MSG-0326-1844"

    # Scan header rows
    for r in range(1, 6):
        for c in range(1, 10):
            val = str(ws.cell(row=r, column=c).value or "").strip()
            if val.lower().startswith("client"):
                parts = val.split(":", 1)
                if len(parts) > 1 and parts[1].strip():
                    client_name = parts[1].strip()
            elif val.lower().startswith("po number"):
                parts = val.split(":", 1)
                if len(parts) > 1 and parts[1].strip():
                    po_number = parts[1].strip()
            elif val.lower().startswith("msg ref"):
                parts = val.split(":", 1)
                if len(parts) > 1 and parts[1].strip():
                    msg_ref = parts[1].strip()

    # Find table header
    header_row = 5
    for r in range(1, 10):
        row_vals = [str(ws.cell(row=r, column=c).value or "").strip().lower() for c in range(1, 10)]
        if any("item" in v or "desc" in v for v in row_vals):
            header_row = r
            break

    col_map = {}
    for c in range(1, 12):
        txt = str(ws.cell(row=header_row, column=c).value or "").strip().upper()
        if "ITEM" in txt and ("CF" in txt or "CLIENT" in txt or "NO" in txt):
            col_map["item_no"] = c
        elif "DESC" in txt:
            col_map["desc"] = c
        elif "QUANTITY" in txt or "QTY" in txt:
            col_map["qty"] = c
        elif "UNIT" in txt or "UOM" in txt:
            col_map["unit"] = c
        elif "HEAT" in txt:
            col_map["heat"] = c
        elif "MAKE" in txt:
            col_map["make"] = c
        elif "CERT" in txt:
            col_map["cert"] = c
        elif "REMARK" in txt:
            col_map["remarks"] = c

    items = []
    for r in range(header_row + 1, ws.max_row + 1):
        desc = str(ws.cell(row=r, column=col_map.get("desc", 2)).value or "").strip()
        if not desc or "TOTAL" in desc.upper():
            continue

        item_no = str(ws.cell(row=r, column=col_map.get("item_no", 1)).value or len(items) + 1).strip()
        qty = str(ws.cell(row=r, column=col_map.get("qty", 3)).value or "1").strip()
        unit = str(ws.cell(row=r, column=col_map.get("unit", 4)).value or "Ea").strip()
        heat = str(ws.cell(row=r, column=col_map.get("heat", 5)).value or "-").strip()
        make = str(ws.cell(row=r, column=col_map.get("make", 6)).value or "DELCORTE, FRANCE").strip()
        cert = str(ws.cell(row=r, column=col_map.get("cert", 7)).value or "-").strip()
        remarks = str(ws.cell(row=r, column=col_map.get("remarks", 8)).value or "LOCATION-1").strip()

        items.append({
            "client": client_name,
            "po": po_number,
            "item_no": item_no,
            "desc": desc,
            "qty": f"{qty} {unit}".strip(),
            "heat": heat,
            "make": make,
            "cert": cert,
            "remarks": remarks
        })

    return client_name, po_number, items

def wrap_text_reportlab(c, text, max_width, font_name="Times-Bold", font_size=7.3, max_lines=3):
    words = text.replace('\r', ' ').replace('\n', ' ').split()
    lines = []
    cur = ""
    for w in words:
        test = f"{cur} {w}".strip()
        if c.stringWidth(test, font_name, font_size) <= max_width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
            if len(lines) == max_lines - 1:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    return lines

def build_58mm_stickers_pdf(items, output_pdf_path, logo_path=None, client_name="STS Bahrain", po_number="BSTSPO260300029-Location-1"):
    c = canvas.Canvas(output_pdf_path, pagesize=(PAGE_WIDTH, PAGE_HEIGHT))

    for it in items:
        c.setFont("Times-Bold", 7.3)
        c.setFillColorRGB(0, 0, 0)

        c_name = it.get("client") or client_name
        po_num = it.get("po") or po_number
        item_no = str(it.get("item_no", "1"))

        # 1. Header (Left)
        c.drawString(5.67, 97.58, c_name)
        c.drawString(5.67, 89.19, f"PO Number: {po_num}")
        c.drawString(5.67, 80.79, f"ITEM NO: {item_no}")

        # 2. Logo (Top Right: x=121.89, y=86.46, w=34.02, h=19.84)
        if logo_path and os.path.exists(logo_path):
            try:
                c.drawImage(logo_path, 121.89, 86.46, width=34.02, height=19.84, mask="auto")
            except Exception as e:
                print(f"Error drawing logo: {e}")

        # 3. Description (Wrapped up to 3 lines at y=69.48, 61.08, 52.69)
        desc_lines = wrap_text_reportlab(c, it.get("desc", ""), 153.07, font_name="Times-Bold", font_size=7.3, max_lines=3)
        y_desc = 69.48
        for d_line in desc_lines:
            c.drawString(5.67, y_desc, d_line)
            y_desc -= 8.40

        # 4. Specifications
        qty_str = it.get("qty", "1 Ea")
        heat_str = it.get("heat", "-")
        make_str = it.get("make", "DELCORTE, FRANCE")
        cert_str = it.get("cert", "-")
        remarks_str = it.get("remarks", "LOCATION-1")

        c.drawString(5.67, 40.64, f"PO QTY: {qty_str}")
        c.drawString(5.67, 32.25, f"HEAT NUMBER: {heat_str}")
        c.drawString(5.67, 23.85, f"MAKE: {make_str}")
        c.drawString(5.67, 15.46, f"CERTIFICATE NO: {cert_str}")
        c.drawString(5.67, 7.06, f"Remarks: {remarks_str}")

        # 5. QR Code (Bottom Right: x=138.90, y=5.67, w=17.01, h=17.01)
        try:
            qr_data = f"ITEM:{item_no}|PO:{po_num}|HEAT:{heat_str}|MAKE:{make_str}|QTY:{qty_str}"
            qr_widget = qr.QrCodeWidget(qr_data)
            bounds = qr_widget.getBounds()
            w = bounds[2] - bounds[0]
            h = bounds[3] - bounds[1]
            d = Drawing(17.01, 17.01, transform=[17.01 / w, 0, 0, 17.01 / h, 0, 0])
            d.add(qr_widget)
            renderPDF.draw(d, c, 138.90, 5.67)
        except Exception as qre:
            print(f"QR error: {qre}")

        c.showPage()

    c.save()
    return output_pdf_path
