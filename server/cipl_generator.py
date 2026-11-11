import os
import io
import re
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.drawing.image import Image
from openpyxl.utils import get_column_letter
from pdf_parser import auto_detect_country_of_origin, auto_detect_hs_code

# Helper: Number to Words for Invoice Total
def num_to_words(num):
    num = int(round(num))
    if num == 0:
        return "ZERO"
    
    ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
            "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
            "SEVENTEEN", "EIGHTEEN", "NINETEEN"]
    tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"]
    
    def convert_below_thousand(n):
        res = []
        if n >= 100:
            res.append(ones[n // 100] + " HUNDRED")
            n %= 100
        if n >= 20:
            res.append(tens[n // 10])
            n %= 10
        if n > 0:
            res.append(ones[n])
        return " ".join(res)
    
    scales = [(1000000000, "BILLION"), (1000000, "MILLION"), (1000, "THOUSAND")]
    words = []
    
    for scale_val, scale_name in scales:
        if num >= scale_val:
            chunk = num // scale_val
            words.append(convert_below_thousand(chunk) + " " + scale_name)
            num %= scale_val
            
    if num > 0:
        words.append(convert_below_thousand(num))
        
    return " ".join(words).strip()


def estimate_unit_weight(desc, uom='EA'):
    """Estimate a realistic unit weight in kg based on size and rating if not provided."""
    d = desc.upper()
    wt = 0.5  # default
    if 'DN 50' in d or '2"' in d or '2 INCH' in d:
        wt = 0.75 if '#3000' in d else 1.10
    elif 'DN 25' in d or '1"' in d or '1 INCH' in d:
        wt = 0.35 if '#3000' in d else 0.50
    elif 'DN 20' in d or '3/4"' in d:
        wt = 0.20 if '#3000' in d else 0.25
    elif 'DN 15' in d or '1/2"' in d:
        wt = 0.10 if '#3000' in d else 0.15
    elif 'DN 10' in d or '3/8"' in d:
        wt = 0.05 if '#3000' in d else 0.08
    elif 'FLANGE' in d:
        wt = 4.5
    elif 'VALVE' in d:
        wt = 3.5
    elif 'TEE' in d:
        wt = 0.8
    elif 'ELBOW' in d:
        wt = 0.6
    elif 'NIPPLE' in d or 'PLUG' in d:
        wt = 0.15
    return wt


def apply_cell_border(ws, start_row, start_col, end_row, end_col, border):
    """Applies border to an entire rectangular region of cells (useful for merged cells)."""
    for r in range(start_row, end_row + 1):
        for c in range(start_col, end_col + 1):
            ws.cell(row=r, column=c).border = border


def format_full_hs_code(hs):
    if not hs:
        return "730799000000"
    clean = re.sub(r'[^0-9]', '', str(hs))
    if len(clean) == 8:
        clean = clean + "0000"
    elif len(clean) == 6:
        clean = clean + "000000"
    return clean if clean else "730799000000"


def generate_cipl_excel(data, logo_path=None, output_path=None):
    """
    Generates an exact Excel workbook matching MSG CIPL & Invoice layout:
    1. INVOICE
    2. PACKING LIST
    """
    wb = openpyxl.Workbook()
    
    # Standard styles
    font_family = 'Arial'
    
    f_company = Font(name=font_family, size=9.5, bold=True)
    f_company_sub = Font(name=font_family, size=8.5, bold=False)
    f_company_trn = Font(name=font_family, size=8.5, bold=True)
    
    f_title = Font(name=font_family, size=11, bold=True, underline='single')
    
    f_meta_bold = Font(name=font_family, size=8.5, bold=True)
    f_meta_reg = Font(name=font_family, size=8.5, bold=False)
    
    f_th = Font(name=font_family, size=8.5, bold=True)
    f_data = Font(name=font_family, size=8.5)
    f_data_bold = Font(name=font_family, size=8.5, bold=True)
    
    thin_side = Side(style='thin', color='000000')
    thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    
    # Locate Logo
    if not logo_path:
        default_logo = os.path.join(os.path.dirname(__file__), 'static', 'logo.png')
        if os.path.exists(default_logo):
            logo_path = default_logo
            
    # Metadata extraction
    client_name = data.get('client', 'Valoris Energy Services Company').strip() or 'Valoris Energy Services Company'
    po_number = str(data.get('po_number', '10025 // 10044')).strip() or '10025 // 10044'
    msg_ref = str(data.get('msg_ref', 'MSG-0826-2117 / MSG-0926-2135')).strip() or 'MSG-0826-2117 / MSG-0926-2135'
    
    currency = str(data.get('currency', 'AED')).strip().upper() or 'AED'
    if currency in ['$', 'DOLLAR', 'US DOLLAR', 'US$']:
        currency = 'USD'
    elif currency in ['DIRHAM', 'DHS']:
        currency = 'AED'
    
    inv_no = data.get('inv_no')
    if not inv_no:
        if '/' in msg_ref:
            parts = [p.strip() for p in msg_ref.split('/')]
            inv_no = " / ".join([f"{p}-CI" if not p.endswith('-CI') else p for p in parts])
        else:
            inv_no = f"{msg_ref}-CI" if not msg_ref.endswith('-CI') else msg_ref

    today_str = datetime.now().strftime('%d/%m/%Y')
    
    # Group items into packages/POs
    raw_items = data.get('items', [])
    processed_items = []
    
    distinct_origins = set()
    distinct_hs = set()
    
    for idx, it in enumerate(raw_items, start=1):
        sl = it.get('sl_no', idx)
        client_po_it = it.get('client_po_item_no', str(sl))
        desc = it.get('description', '')
        make = it.get('make', '')
        remarks = it.get('remarks', '')
        
        # Origin & HS
        coo = (it.get('country_of_origin') or auto_detect_country_of_origin(make, desc, remarks)).upper()
        hs = format_full_hs_code(it.get('hs_code') or auto_detect_hs_code(desc))
        
        distinct_origins.add(coo)
        distinct_hs.add(hs)
        
        # Qty
        qty_raw = str(it.get('qty', '1')).strip()
        m_of = re.search(r'([\d.]+)\s*(?:OF|of)', qty_raw, re.I)
        if m_of:
            try:
                qty_val = float(m_of.group(1))
            except ValueError:
                qty_val = 1.0
        else:
            try:
                qty_val = float(qty_raw.replace(',', '')) if qty_raw else 1.0
            except ValueError:
                qty_val = 1.0
                
        uom = it.get('uom', 'EA').upper()
        if uom in ['PCS', 'PC', 'NOS']:
            uom = 'EA'
            
        # Rate & Amount
        rate_raw = str(it.get('rate', '')).replace(',', '').strip()
        try:
            rate_val = float(rate_raw) if rate_raw else 25.0
        except ValueError:
            rate_val = 25.0
            
        amt_raw = str(it.get('amount', '')).replace(',', '').strip()
        try:
            amt_val = float(amt_raw) if amt_raw else (qty_val * rate_val)
        except ValueError:
            amt_val = qty_val * rate_val
            
        # Packaging
        pkg_type = it.get('package_type', 'CARTON BOX').upper()
        if 'BOX' in pkg_type:
            pkg_type = 'CARTON BOX'
        elif 'PALLET' in pkg_type:
            pkg_type = 'PALLET'
        elif 'CRATE' in pkg_type:
            pkg_type = 'WOODEN CRATE'
            
        pkg_no = str(it.get('package_no', '1')).strip()
        
        # Weights & Dims
        unit_wt = it.get('unit_weight')
        if unit_wt is None or unit_wt == '':
            unit_wt = estimate_unit_weight(desc, uom)
        else:
            try:
                unit_wt = float(str(unit_wt).replace(',', ''))
            except ValueError:
                unit_wt = estimate_unit_weight(desc, uom)
                
        tot_wt = it.get('total_weight')
        if tot_wt is None or tot_wt == '':
            tot_wt = round(qty_val * unit_wt, 2)
        else:
            try:
                tot_wt = float(str(tot_wt).replace(',', ''))
            except ValueError:
                tot_wt = round(qty_val * unit_wt, 2)
                
        dims = it.get('dimensions') or ('25 X 20 X 10 CM' if pkg_no == '1' else '35 X 20 X 15 CM')
        item_po = it.get('po_number') or (po_number.split('//')[0].strip() if '//' in po_number and pkg_no == '1' else (po_number.split('//')[-1].strip() if '//' in po_number else po_number))
        
        processed_items.append({
            'sl_no': sl,
            'client_po_item_no': client_po_it,
            'description': desc,
            'qty': qty_val,
            'uom': uom,
            'hs_code': hs,
            'origin': coo,
            'rate': rate_val,
            'amount': amt_val,
            'package_type': pkg_type,
            'package_no': pkg_no,
            'dims': dims,
            'unit_weight': unit_wt,
            'total_weight': tot_wt,
            'po_number': item_po
        })

    origin_summary_str = ", ".join(sorted(list(distinct_origins))) if distinct_origins else "FRANCE, ITALY, TAIWAN"
    hs_summary_str = f"CS Fittings: {'; '.join(sorted(list(distinct_hs)))};" if distinct_hs else "CS Fittings: 730799000000;"

    # Helper to render top company header & metadata block
    def render_common_header(ws, title_text):
        ws.views.sheetView[0].showGridLines = True
        
        # Column widths
        ws.column_dimensions['A'].width = 8.5   # SR NO
        ws.column_dimensions['B'].width = 46.0  # DESCRIPTION
        ws.column_dimensions['C'].width = 8.0   # QTY
        ws.column_dimensions['D'].width = 8.0   # UOM
        ws.column_dimensions['E'].width = 16.0  # H.S. CODE
        ws.column_dimensions['F'].width = 14.0  # ORIGIN
        ws.column_dimensions['G'].width = 16.0  # UNIT PRICE/AED or UNIT WEIGHT
        ws.column_dimensions['H'].width = 18.0  # TOTAL VALUE/AED or TOTAL WEIGHT
        
        # Top Company Info (Left)
        ws['A1'] = "MSG OILFIELD EQUIPMENT TRADING LLC"
        ws['A1'].font = f_company
        ws['A2'] = "DUBAI INDUSTRIAL CITY (DIC), PHASE 1"
        ws['A2'].font = f_company_sub
        ws['A3'] = "SAI SHUAIB 2, WAREHOUSE NO: J-04,"
        ws['A3'].font = f_company_sub
        ws['A4'] = "DUBAI, UNITED ARAB EMIRATES"
        ws['A4'].font = f_company_sub
        ws['A5'] = "TRN NO:100518964000003"
        ws['A5'].font = f_company_trn
        
        # Insert Logo (Top Right/Center)
        if logo_path and os.path.exists(logo_path):
            try:
                img = Image(logo_path)
                img.width = 135
                img.height = 45
                ws.add_image(img, 'E1')
            except Exception as e:
                print(f"Could not add logo: {e}")
                
        # Title Row
        ws.merge_cells('A6:H6')
        ws['A6'] = title_text
        ws['A6'].font = f_title
        ws['A6'].alignment = Alignment(horizontal='center', vertical='center')
        ws.row_dimensions[6].height = 22
        
        # Metadata Outer Box (Rows 7 to 18)
        # Left Box (Cols A to D)
        ws.merge_cells('A7:D7')
        ws['A7'] = "CONSIGNEE :-"
        ws['A7'].font = f_meta_bold
        
        ws.merge_cells('A8:D8')
        ws['A8'] = client_name
        ws['A8'].font = f_meta_reg
        
        ws.merge_cells('A9:D9')
        ws['A9'] = "Al-Alyha, Abqaiq,"
        ws['A9'].font = f_meta_reg
        
        ws.merge_cells('A10:D10')
        ws['A10'] = "Eastern Province Area -33267,"
        ws['A10'].font = f_meta_reg
        
        ws.merge_cells('A11:D11')
        ws['A11'] = "Kingdom of Saudi Arabia"
        ws['A11'].font = f_meta_reg
        
        ws.merge_cells('A12:D12')
        ws['A12'] = "Tel: +966 38084168"
        ws['A12'].font = f_meta_reg
        
        ws.merge_cells('A13:D13')
        ws['A13'] = ""
        
        ws.merge_cells('A14:D14')
        ws['A14'] = f"ORDER NUMBER : {po_number}"
        ws['A14'].font = f_meta_bold
        
        ws.merge_cells('A15:D15')
        ws['A15'] = "MODE OF SHIPMENT : BY LAND"
        ws['A15'].font = f_meta_bold
        
        ws.merge_cells('A16:D16')
        ws['A16'] = "FREIGHT TERMS : EX-WORKS"
        ws['A16'].font = f_meta_bold
        
        ws.merge_cells('A17:D17')
        ws['A17'] = "PLACE OF LOADING : DUBAI, U.A.E"
        ws['A17'].font = f_meta_bold
        
        ws.merge_cells('A18:D18')
        ws['A18'] = "PLACE OF DISCHARGE : SAUDI ARABIA"
        ws['A18'].font = f_meta_bold
        
        # Right Box (Cols E to H)
        ws.merge_cells('E7:H7')
        ws['E7'] = f"DATE : {today_str}"
        ws['E7'].font = f_meta_bold
        
        ws.merge_cells('E8:H8')
        ws['E8'] = f"Inv.No :              {inv_no}"
        ws['E8'].font = f_meta_bold
        
        ws.merge_cells('E9:H9')
        ws['E9'] = ""
        
        ws.merge_cells('E10:H10')
        ws['E10'] = f"S O.REF: {msg_ref}"
        ws['E10'].font = f_meta_bold
        
        ws.merge_cells('E11:H11')
        ws['E11'] = "SOLD TO / INVOICED TO"
        ws['E11'].font = f_meta_bold
        
        ws.merge_cells('E12:H12')
        ws['E12'] = client_name
        ws['E12'].font = f_meta_reg
        
        ws.merge_cells('E13:H13')
        ws['E13'] = "Al-Alyha, Abqaiq, Eastern Province Area -33267,"
        ws['E13'].font = f_meta_reg
        
        ws.merge_cells('E14:H14')
        ws['E14'] = "Kingdom of Saudi Arabia"
        ws['E14'].font = f_meta_reg
        
        ws.merge_cells('E15:H15')
        ws['E15'] = "TRN : 313093495600003"
        ws['E15'].font = f_meta_bold
        
        ws.merge_cells('E16:H16')
        ws['E16'] = "HS CODE:"
        ws['E16'].font = f_meta_bold
        
        ws.merge_cells('E17:H17')
        ws['E17'] = hs_summary_str
        ws['E17'].font = f_meta_reg
        
        ws.merge_cells('E18:H18')
        ws['E18'] = f"COUNTRY OF ORIGIN : {origin_summary_str}"
        ws['E18'].font = f_meta_bold
        
        for r in range(7, 19):
            ws.row_dimensions[r].height = 14.5
            for c in range(1, 9):
                # Inner & outer box borders
                top_s = thin_side if r == 7 else None
                bot_s = thin_side if r == 18 else None
                left_s = thin_side if (c == 1 or c == 5) else None
                right_s = thin_side if (c == 4 or c == 8) else None
                ws.cell(row=r, column=c).border = Border(top=top_s, bottom=bot_s, left=left_s, right=right_s)
                
        return 19


    # =========================================================================
    # 1. SHEET: INVOICE
    # =========================================================================
    ws_inv = wb.active
    ws_inv.title = "INVOICE"
    
    start_row = render_common_header(ws_inv, "INVOICE")
    
    # Table Header (Row 19)
    inv_headers = ["SR NO", "DESCRIPTION", "QTY", "UOM", "H.S. CODE", "ORIGIN", f"UNIT PRICE/{currency}", f"TOTAL VALUE/{currency}"]
    ws_inv.row_dimensions[start_row].height = 24
    for c_idx, h in enumerate(inv_headers, start=1):
        cell = ws_inv.cell(row=start_row, column=c_idx, value=h)
        cell.font = f_th
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border
        
    curr_row = start_row + 1
    
    # Group items by PO Number
    po_groups = {}
    for it in processed_items:
        p_num = it['po_number']
        if p_num not in po_groups:
            po_groups[p_num] = []
        po_groups[p_num].append(it)
        
    grand_total_qty = 0
    grand_total_amt = 0.0
    inv_item_rows = []
    
    for p_num, p_items in po_groups.items():
        # PO Header Row
        ws_inv.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
        c_po = ws_inv.cell(row=curr_row, column=1, value=f"PO NO: {p_num}")
        c_po.font = f_data_bold
        c_po.alignment = Alignment(horizontal='left', vertical='center', indent=1)
        apply_cell_border(ws_inv, curr_row, 1, curr_row, 8, thin_border)
        ws_inv.row_dimensions[curr_row].height = 20
        curr_row += 1
        
        for p_idx, it in enumerate(p_items, start=1):
            inv_item_rows.append(curr_row)
            ws_inv.cell(row=curr_row, column=1, value=p_idx).alignment = Alignment(horizontal='center', vertical='center')
            ws_inv.cell(row=curr_row, column=2, value=it['description']).alignment = Alignment(horizontal='left', vertical='center')
            ws_inv.cell(row=curr_row, column=3, value=int(it['qty']) if it['qty'].is_integer() else it['qty']).alignment = Alignment(horizontal='center', vertical='center')
            ws_inv.cell(row=curr_row, column=4, value=it['uom']).alignment = Alignment(horizontal='center', vertical='center')
            ws_inv.cell(row=curr_row, column=5, value=it['hs_code']).alignment = Alignment(horizontal='center', vertical='center')
            ws_inv.cell(row=curr_row, column=6, value=it['origin']).alignment = Alignment(horizontal='center', vertical='center')
            
            c_rate = ws_inv.cell(row=curr_row, column=7, value=it['rate'])
            c_rate.alignment = Alignment(horizontal='right', vertical='center')
            c_rate.number_format = '0.00'
            
            # Formula: Qty into Price
            c_amt = ws_inv.cell(row=curr_row, column=8, value=f"=C{curr_row}*G{curr_row}")
            c_amt.alignment = Alignment(horizontal='right', vertical='center')
            c_amt.number_format = '0.00'
            
            for c in range(1, 9):
                ws_inv.cell(row=curr_row, column=c).font = f_data
                ws_inv.cell(row=curr_row, column=c).border = thin_border
                
            grand_total_qty += it['qty']
            grand_total_amt += it['amount']
            ws_inv.row_dimensions[curr_row].height = 20
            curr_row += 1
            
    # Bottom Total Row
    r_inv_total = curr_row
    first_item_r = inv_item_rows[0] if inv_item_rows else (start_row + 2)
    last_item_r = inv_item_rows[-1] if inv_item_rows else (start_row + 2)

    ws_inv.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=2)
    c_tot_label = ws_inv.cell(row=curr_row, column=1, value=f"TOTAL VALUE IN {currency}.")
    c_tot_label.font = f_data_bold
    c_tot_label.alignment = Alignment(horizontal='center', vertical='center')
    
    # Formula: Total Qty
    c_tot_q = ws_inv.cell(row=curr_row, column=3, value=f"=SUM(C{first_item_r}:C{last_item_r})")
    c_tot_q.font = f_data_bold
    c_tot_q.alignment = Alignment(horizontal='center', vertical='center')
    
    c_tot_uom = ws_inv.cell(row=curr_row, column=4, value="NOS")
    c_tot_uom.font = f_data_bold
    c_tot_uom.alignment = Alignment(horizontal='center', vertical='center')
    
    ws_inv.cell(row=curr_row, column=5, value="").border = thin_border
    ws_inv.cell(row=curr_row, column=6, value="").border = thin_border
    
    c_cur = ws_inv.cell(row=curr_row, column=7, value=currency)
    c_cur.font = f_data_bold
    c_cur.alignment = Alignment(horizontal='center', vertical='center')
    
    # Formula: Total Value
    c_tot_val = ws_inv.cell(row=curr_row, column=8, value=f"=SUM(H{first_item_r}:H{last_item_r})")
    c_tot_val.font = f_data_bold
    c_tot_val.alignment = Alignment(horizontal='right', vertical='center')
    c_tot_val.number_format = '0.00'
    
    apply_cell_border(ws_inv, curr_row, 1, curr_row, 8, thin_border)
    ws_inv.row_dimensions[curr_row].height = 22
    curr_row += 1
    
    # In Words Box
    curr_row += 1
    ws_inv.merge_cells(start_row=curr_row, start_column=1, end_row=curr_row, end_column=8)
    words_str = f"IN WORDS : {currency}. {num_to_words(grand_total_amt)} ONLY"
    c_words = ws_inv.cell(row=curr_row, column=1, value=words_str)
    c_words.font = f_data_bold
    c_words.alignment = Alignment(horizontal='left', vertical='center', indent=1)
    apply_cell_border(ws_inv, curr_row, 1, curr_row, 8, thin_border)
    ws_inv.row_dimensions[curr_row].height = 20
    curr_row += 1
    
    # Calculate Total Packages, Net & Gross Weight
    pkg_set = set(f"{it['package_type']} {it['package_no']}" for it in processed_items)
    tot_pkg_count = len(pkg_set)
    pkg_type_name = processed_items[0]['package_type'] if processed_items else 'CARTON BOX'
    
    tot_net_wt = sum(it['total_weight'] for it in processed_items)
    tot_gross_wt = tot_net_wt  # identical in sample
    
    # Shipping Marks & Packing Details Box (Rows curr_row to curr_row+4)
    r_box_start = curr_row
    ws_inv.merge_cells(start_row=r_box_start, start_column=1, end_row=r_box_start, end_column=4)
    ws_inv.cell(row=r_box_start, column=1, value=f"PACKING DETAILS: TOTAL OF {tot_pkg_count} PACKAGE").font = f_meta_bold
    
    ws_inv.merge_cells(start_row=r_box_start+1, start_column=1, end_row=r_box_start+1, end_column=4)
    ws_inv.cell(row=r_box_start+1, column=1, value=f"({tot_pkg_count} {pkg_type_name})").font = f_meta_reg
    
    ws_inv.merge_cells(start_row=r_box_start+2, start_column=1, end_row=r_box_start+2, end_column=4)
    ws_inv.cell(row=r_box_start+2, column=1, value=f"NET WEIGHT : {tot_net_wt:.2f} KGS").font = f_meta_bold
    
    ws_inv.merge_cells(start_row=r_box_start+3, start_column=1, end_row=r_box_start+3, end_column=4)
    ws_inv.cell(row=r_box_start+3, column=1, value=f"GROSS WEIGHT : {tot_gross_wt:.2f} KGS").font = f_meta_bold
    
    # Right side: Shipping marks
    ws_inv.merge_cells(start_row=r_box_start, start_column=5, end_row=r_box_start, end_column=8)
    ws_inv.cell(row=r_box_start, column=5, value="SHIPPING MARKS :-").font = f_meta_bold
    
    ws_inv.merge_cells(start_row=r_box_start+1, start_column=5, end_row=r_box_start+1, end_column=8)
    ws_inv.cell(row=r_box_start+1, column=5, value=client_name).font = f_meta_reg
    
    ws_inv.merge_cells(start_row=r_box_start+2, start_column=5, end_row=r_box_start+2, end_column=8)
    ws_inv.cell(row=r_box_start+2, column=5, value="Al-Alyha, Abqaiq, Eastern Province Area -33267,").font = f_meta_reg
    
    ws_inv.merge_cells(start_row=r_box_start+3, start_column=5, end_row=r_box_start+3, end_column=8)
    ws_inv.cell(row=r_box_start+3, column=5, value="Kingdom of Saudi Arabia").font = f_meta_reg
    
    ws_inv.merge_cells(start_row=r_box_start+4, start_column=5, end_row=r_box_start+4, end_column=8)
    ws_inv.cell(row=r_box_start+4, column=5, value=f"PO REF # {po_number}").font = f_meta_bold
    
    for r in range(r_box_start, r_box_start + 5):
        ws_inv.row_dimensions[r].height = 14.5
        for c in range(1, 9):
            top_s = thin_side if r == r_box_start else None
            bot_s = thin_side if r == (r_box_start + 4) else None
            left_s = thin_side if (c == 1 or c == 5) else None
            right_s = thin_side if (c == 4 or c == 8) else None
            ws_inv.cell(row=r, column=c).border = Border(top=top_s, bottom=bot_s, left=left_s, right=right_s)


    # =========================================================================
    # 2. SHEET: PACKING LIST
    # =========================================================================
    ws_pk = wb.create_sheet(title="PACKING LIST")
    start_row_pk = render_common_header(ws_pk, "PACKING LIST")
    
    # Table Header (Row 19)
    pk_headers = ["SR NO", "DESCRIPTION", "QTY", "UOM", "H.S. CODE", "ORIGIN", "UNIT WEIGHT /\nKGS", "TOTAL WEIGHT /\nKGS"]
    ws_pk.row_dimensions[start_row_pk].height = 24
    for c_idx, h in enumerate(pk_headers, start=1):
        cell = ws_pk.cell(row=start_row_pk, column=c_idx, value=h)
        cell.font = f_th
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border
        
    curr_pk_row = start_row_pk + 1
    
    # Group items by Package (Carton Box 1, Carton Box 2, etc.)
    pkg_groups = {}
    for it in processed_items:
        pkey = f"{it['package_type']} - {it['package_no']}"
        if pkey not in pkg_groups:
            pkg_groups[pkey] = {
                'label': pkey,
                'dims': it['dims'],
                'items': []
            }
        pkg_groups[pkey]['items'].append(it)
        
    total_pk_qty = 0
    total_pk_net_wt = 0.0
    total_pk_gross_wt = 0.0
    pk_item_rows = []
    pkg_subtotal_rows = []
    
    for pkey, pinfo in pkg_groups.items():
        # Package Header Row (e.g. CARTON BOX - 1 | 25 X 20 X 10 CM)
        ws_pk.merge_cells(start_row=curr_pk_row, start_column=1, end_row=curr_pk_row, end_column=6)
        c_pk_title = ws_pk.cell(row=curr_pk_row, column=1, value=pinfo['label'])
        c_pk_title.font = f_data_bold
        c_pk_title.alignment = Alignment(horizontal='center', vertical='center')
        
        ws_pk.merge_cells(start_row=curr_pk_row, start_column=7, end_row=curr_pk_row, end_column=8)
        c_pk_dims = ws_pk.cell(row=curr_pk_row, column=7, value=pinfo['dims'])
        c_pk_dims.font = f_data_bold
        c_pk_dims.alignment = Alignment(horizontal='center', vertical='center')
        
        apply_cell_border(ws_pk, curr_pk_row, 1, curr_pk_row, 8, thin_border)
        ws_pk.row_dimensions[curr_pk_row].height = 20
        curr_pk_row += 1
        
        # Package sub-groups by PO Number
        pkg_po_groups = {}
        for it in pinfo['items']:
            p_num = it['po_number']
            if p_num not in pkg_po_groups:
                pkg_po_groups[p_num] = []
            pkg_po_groups[p_num].append(it)
            
        carton_item_rows = []
        carton_net_wt = 0.0
        carton_gross_wt = 0.0
        
        for p_num, po_items in pkg_po_groups.items():
            # PO Subheader Row
            ws_pk.merge_cells(start_row=curr_pk_row, start_column=1, end_row=curr_pk_row, end_column=8)
            c_po = ws_pk.cell(row=curr_pk_row, column=1, value=f"PO NO: {p_num}")
            c_po.font = f_data_bold
            c_po.alignment = Alignment(horizontal='left', vertical='center', indent=1)
            apply_cell_border(ws_pk, curr_pk_row, 1, curr_pk_row, 8, thin_border)
            ws_pk.row_dimensions[curr_pk_row].height = 20
            curr_pk_row += 1
            
            for p_idx, it in enumerate(po_items, start=1):
                pk_item_rows.append(curr_pk_row)
                carton_item_rows.append(curr_pk_row)
                ws_pk.cell(row=curr_pk_row, column=1, value=p_idx).alignment = Alignment(horizontal='center', vertical='center')
                ws_pk.cell(row=curr_pk_row, column=2, value=it['description']).alignment = Alignment(horizontal='left', vertical='center')
                ws_pk.cell(row=curr_pk_row, column=3, value=int(it['qty']) if it['qty'].is_integer() else it['qty']).alignment = Alignment(horizontal='center', vertical='center')
                ws_pk.cell(row=curr_pk_row, column=4, value=it['uom']).alignment = Alignment(horizontal='center', vertical='center')
                ws_pk.cell(row=curr_pk_row, column=5, value=it['hs_code']).alignment = Alignment(horizontal='center', vertical='center')
                ws_pk.cell(row=curr_pk_row, column=6, value=it['origin']).alignment = Alignment(horizontal='center', vertical='center')
                
                c_uwt = ws_pk.cell(row=curr_pk_row, column=7, value=it['unit_weight'])
                c_uwt.alignment = Alignment(horizontal='right', vertical='center')
                c_uwt.number_format = '0.00'
                
                # Formula: Qty into Unit Weight
                c_twt = ws_pk.cell(row=curr_pk_row, column=8, value=f"=C{curr_pk_row}*G{curr_pk_row}")
                c_twt.alignment = Alignment(horizontal='right', vertical='center')
                c_twt.number_format = '0.00'
                
                for c in range(1, 9):
                    ws_pk.cell(row=curr_pk_row, column=c).font = f_data
                    ws_pk.cell(row=curr_pk_row, column=c).border = thin_border
                    
                total_pk_qty += it['qty']
                carton_net_wt += it['total_weight']
                ws_pk.row_dimensions[curr_pk_row].height = 20
                curr_pk_row += 1
                
        carton_gross_wt = carton_net_wt
        total_pk_net_wt += carton_net_wt
        total_pk_gross_wt += carton_gross_wt
        
        # Package Subtotal Row (NET WEIGHT X.XX | GROSS WEIGHT X.XX)
        r_sub = curr_pk_row
        pkg_subtotal_rows.append(r_sub)
        first_carton_r = carton_item_rows[0] if carton_item_rows else (curr_pk_row - 1)
        last_carton_r = carton_item_rows[-1] if carton_item_rows else (curr_pk_row - 1)

        ws_pk.merge_cells(start_row=curr_pk_row, start_column=1, end_row=curr_pk_row, end_column=5)
        apply_cell_border(ws_pk, curr_pk_row, 1, curr_pk_row, 5, thin_border)
        
        c_lbl_net = ws_pk.cell(row=curr_pk_row, column=6, value="NET WEIGHT")
        c_lbl_net.font = f_data_bold
        c_lbl_net.alignment = Alignment(horizontal='center', vertical='center')
        c_lbl_net.border = thin_border
        
        # Formula: Sum of carton weights
        c_val_net = ws_pk.cell(row=curr_pk_row, column=7, value=f"=SUM(H{first_carton_r}:H{last_carton_r})")
        c_val_net.font = f_data_bold
        c_val_net.alignment = Alignment(horizontal='right', vertical='center')
        c_val_net.number_format = '0.00'
        c_val_net.border = thin_border
        
        # Backward formula: Gross Weight equals Net Weight
        c_lbl_gross = ws_pk.cell(row=curr_pk_row, column=8, value=f'="GROSS WEIGHT: " & TEXT(G{r_sub}, "0.00")')
        c_lbl_gross.font = f_data_bold
        c_lbl_gross.alignment = Alignment(horizontal='center', vertical='center')
        c_lbl_gross.border = thin_border
        
        ws_pk.row_dimensions[curr_pk_row].height = 20
        curr_pk_row += 1

    # Grand Total Packing Rows
    r_grand_net = curr_pk_row
    first_pk_r = pk_item_rows[0] if pk_item_rows else (start_row_pk + 2)
    last_pk_r = pk_item_rows[-1] if pk_item_rows else (start_row_pk + 2)
    sub_net_formula = "=" + "+".join([f"G{r}" for r in pkg_subtotal_rows]) if pkg_subtotal_rows else f"=SUM(H{first_pk_r}:H{last_pk_r})"

    # Row 1: TOTAL NET WEIGHT IN KGS.
    ws_pk.merge_cells(start_row=curr_pk_row, start_column=1, end_row=curr_pk_row, end_column=2)
    c_tot_q = ws_pk.cell(row=curr_pk_row, column=3, value=f"=SUM(C{first_pk_r}:C{last_pk_r})")
    c_tot_q.font = f_data_bold
    c_tot_q.alignment = Alignment(horizontal='center', vertical='center')
    
    c_tot_uom = ws_pk.cell(row=curr_pk_row, column=4, value="NOS")
    c_tot_uom.font = f_data_bold
    c_tot_uom.alignment = Alignment(horizontal='center', vertical='center')
    
    ws_pk.merge_cells(start_row=curr_pk_row, start_column=5, end_row=curr_pk_row, end_column=7)
    c_net_title = ws_pk.cell(row=curr_pk_row, column=5, value="TOTAL NET WEIGHT IN KGS.")
    c_net_title.font = f_data_bold
    c_net_title.alignment = Alignment(horizontal='center', vertical='center')
    
    # Formula: Total Net Weight
    c_net_tot = ws_pk.cell(row=curr_pk_row, column=8, value=sub_net_formula)
    c_net_tot.font = f_data_bold
    c_net_tot.alignment = Alignment(horizontal='right', vertical='center')
    c_net_tot.number_format = '0.00'
    
    apply_cell_border(ws_pk, curr_pk_row, 1, curr_pk_row, 8, thin_border)
    ws_pk.row_dimensions[curr_pk_row].height = 22
    curr_pk_row += 1
    
    # Row 2: TOTAL GROSS WEIGHT IN KGS.
    r_grand_gross = curr_pk_row
    ws_pk.merge_cells(start_row=curr_pk_row, start_column=5, end_row=curr_pk_row, end_column=7)
    c_gross_title = ws_pk.cell(row=curr_pk_row, column=5, value="TOTAL GROSS WEIGHT IN KGS.")
    c_gross_title.font = f_data_bold
    c_gross_title.alignment = Alignment(horizontal='center', vertical='center')
    
    # Backward formula: Total Gross Weight references Total Net Weight
    c_gross_tot = ws_pk.cell(row=curr_pk_row, column=8, value=f"=H{r_grand_net}")
    c_gross_tot.font = f_data_bold
    c_gross_tot.alignment = Alignment(horizontal='right', vertical='center')
    c_gross_tot.number_format = '0.00'
    
    apply_cell_border(ws_pk, curr_pk_row, 5, curr_pk_row, 8, thin_border)
    ws_pk.row_dimensions[curr_pk_row].height = 22
    curr_pk_row += 2
    
    # Shipping Marks & Packing Details Box
    r_pk_box = curr_pk_row
    ws_pk.merge_cells(start_row=r_pk_box, start_column=1, end_row=r_pk_box, end_column=4)
    ws_pk.cell(row=r_pk_box, column=1, value=f"PACKING DETAILS: TOTAL OF {tot_pkg_count} PACKAGE").font = f_meta_bold
    
    ws_pk.merge_cells(start_row=r_pk_box+1, start_column=1, end_row=r_pk_box+1, end_column=4)
    ws_pk.cell(row=r_pk_box+1, column=1, value=f"({tot_pkg_count} {pkg_type_name})").font = f_meta_reg
    
    ws_pk.merge_cells(start_row=r_pk_box+2, start_column=1, end_row=r_pk_box+2, end_column=4)
    ws_pk.cell(row=r_pk_box+2, column=1, value=f'="NET WEIGHT : " & TEXT(H{r_grand_net}, "0.00") & " KGS"').font = f_meta_bold
    
    ws_pk.merge_cells(start_row=r_pk_box+3, start_column=1, end_row=r_pk_box+3, end_column=4)
    ws_pk.cell(row=r_pk_box+3, column=1, value=f'="GROSS WEIGHT : " & TEXT(H{r_grand_gross}, "0.00") & " KGS"').font = f_meta_bold
    
    # Right side: Shipping marks
    ws_pk.merge_cells(start_row=r_pk_box, start_column=5, end_row=r_pk_box, end_column=8)
    ws_pk.cell(row=r_pk_box, column=5, value="SHIPPING MARKS :-").font = f_meta_bold
    
    ws_pk.merge_cells(start_row=r_pk_box+1, start_column=5, end_row=r_pk_box+1, end_column=8)
    ws_pk.cell(row=r_pk_box+1, column=5, value=client_name).font = f_meta_reg
    
    ws_pk.merge_cells(start_row=r_pk_box+2, start_column=5, end_row=r_pk_box+2, end_column=8)
    ws_pk.cell(row=r_pk_box+2, column=5, value="Al-Alyha, Abqaiq, Eastern Province Area -33267,").font = f_meta_reg
    
    ws_pk.merge_cells(start_row=r_pk_box+3, start_column=5, end_row=r_pk_box+3, end_column=8)
    ws_pk.cell(row=r_pk_box+3, column=5, value="Kingdom of Saudi Arabia").font = f_meta_reg
    
    ws_pk.merge_cells(start_row=r_pk_box+4, start_column=5, end_row=r_pk_box+4, end_column=8)
    ws_pk.cell(row=r_pk_box+4, column=5, value=f"PO REF # {po_number}").font = f_meta_bold
    
    for r in range(r_pk_box, r_pk_box + 5):
        ws_pk.row_dimensions[r].height = 14.5
        for c in range(1, 9):
            top_s = thin_side if r == r_pk_box else None
            bot_s = thin_side if r == (r_pk_box + 4) else None
            left_s = thin_side if (c == 1 or c == 5) else None
            right_s = thin_side if (c == 4 or c == 8) else None
            ws_pk.cell(row=r, column=c).border = Border(top=top_s, bottom=bot_s, left=left_s, right=right_s)

    if output_path:
        wb.save(output_path)
        return output_path
    else:
        out = io.BytesIO()
        wb.save(out)
        out.seek(0)
        return out
