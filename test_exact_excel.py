import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.drawing.image import Image as OpenpyxlImage
import os

def create_summary_sheet():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "SUMMARY SHEET"
    
    # Fonts & Styles
    title_font = Font(name="Calibri", size=14, bold=True)
    meta_font = Font(name="Calibri", size=11, bold=True)
    hdr_font = Font(name="Calibri", size=10, bold=True)
    data_font = Font(name="Calibri", size=10)
    
    thin = Side(border_style="thin", color="000000")
    thin_border = Border(left=thin, right=thin, top=thin, bottom=thin)
    
    hdr_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")
    
    # 1. Row 1: SUMMARY SHEET
    ws.merge_cells("A1:I1")
    cell_a1 = ws["A1"]
    cell_a1.value = "SUMMARY SHEET"
    cell_a1.font = title_font
    cell_a1.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28
    
    # 2. Metadata Rows 2, 3, 4
    ws.merge_cells("A2:F2")
    ws["A2"] = "Client :Bahrain Special Technical Services (STS) Co. W.L.L"
    ws["A2"].font = meta_font
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[2].height = 20
    
    ws.merge_cells("A3:F3")
    ws["A3"] = "PO Number: BSTSPO260300029-Location-1"
    ws["A3"].font = meta_font
    ws["A3"].alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[3].height = 20
    
    ws.merge_cells("A4:F4")
    ws["A4"] = "MSG Ref:   MSG-0326-1844"
    ws["A4"].font = meta_font
    ws["A4"].alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[4].height = 20
    
    # Logo in G2:I4
    if os.path.exists("public/logo.png"):
        img = OpenpyxlImage("public/logo.png")
        img.width = 160
        img.height = 55
        ws.add_image(img, "G2")
        
    for r in range(1, 5):
        for c in range(1, 10):
            ws.cell(row=r, column=c).border = thin_border
            
    # 3. Row 5: Column Headers
    headers = [
        "Item.CF.Client PO Item No",
        "Item Desc",
        "QuantityOrdered",
        "Unit",
        "Heat Number",
        "Make",
        "Certificate Number",
        "Remarks",
        "BAPCO APPROVED TRANSMITTAL NUMBER"
    ]
    
    ws.row_dimensions[5].height = 26
    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=5, column=col_idx, value=h)
        cell.font = hdr_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.fill = hdr_fill
        cell.border = thin_border
        
    # 4. Data Rows
    items = [
        {
            "item_no": "17",
            "desc": '1.1/2" 90 DEGREE ELBOW, ASME B16.11, ASTM A105N, SW ENDS, 6000 LBS',
            "qty": "8",
            "unit": "Ea",
            "heat": "EY7",
            "make": "DELCORTE, FRANCE",
            "cert": "232442/3",
            "remarks": "LOCATION-1",
            "transmittal": "TRA-STS-BAP-0157"
        },
        {
            "item_no": "27",
            "desc": '2" X SCH160, 90 DEGREE ELBOW LONG RADIUS (R=1.5D), SEAMLESS, ASME B16.9, ASTM A420 GR.WPL6, BW ENDS',
            "qty": "4 OF 10",
            "unit": "Ea",
            "heat": "67M01M085",
            "make": "BENKAN, THAILAND",
            "cert": "T202511670073",
            "remarks": "LOCATION-1",
            "transmittal": "TRA-STS-BAP-0157"
        }
    ]
    
    for r_idx, it in enumerate(items, 6):
        ws.row_dimensions[r_idx].height = 32
        row_vals = [
            it["item_no"],
            it["desc"],
            it["qty"],
            it["unit"],
            it["heat"],
            it["make"],
            it["cert"],
            it["remarks"],
            it["transmittal"]
        ]
        for c_idx, val in enumerate(row_vals, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if c_idx in [1, 3, 4, 5, 7, 8, 9]:
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
                
    # Column widths
    col_widths = [14, 48, 14, 8, 16, 22, 20, 16, 26]
    for idx, w in enumerate(col_widths, 1):
        col_letter = openpyxl.utils.get_column_letter(idx)
        ws.column_dimensions[col_letter].width = w
        
    wb.save("test_summary_sheet.xlsx")
    print("Generated test_summary_sheet.xlsx successfully!")

create_summary_sheet()
