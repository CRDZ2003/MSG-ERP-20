import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import fitz

def generate_test_stamped_mtc():
    c = canvas.Canvas('test_stamped_mtc.pdf', pagesize=A4)
    w, h = A4
    
    # Background content
    c.setFont('Helvetica-Bold', 14)
    c.drawString(40, h - 50, "MILL TEST CERTIFICATE EN 10204 3.1")
    c.setFont('Helvetica', 10)
    c.drawString(40, h - 70, "Material Grade: ASTM A105N | SA-105 | SA-350 LF2")
    c.drawString(40, h - 90, "Chemical & Mechanical Test Results Satisfactory")
    
    # Table box
    c.rect(40, h - 350, w - 80, 240)
    c.drawString(50, h - 120, "Heat Number: EY7 | Melt Spec: EAF + LF + VD")
    c.drawString(50, h - 140, "Yield: 345 MPa | Tensile: 560 MPa | Elongation: 32%")
    c.drawString(50, h - 160, "Impact Test @ -46C: 45J, 48J, 52J (Avg: 48.3J)")
    
    # Transparent Seal
    seal_path = 'public/assets/seal_transparent.png'
    stamp_w = 210
    stamp_h = 210 * (424 / 843)  # approx 105.6
    stamp_x = w - stamp_w - 40
    stamp_y = 60
    
    if os.path.exists(seal_path):
        c.drawImage(seal_path, stamp_x, stamp_y, width=stamp_w, height=stamp_h, mask='auto')
        
    # Autofill details above dotted lines
    c.setFont('Helvetica-Bold', 8.5)
    c.setFillColorRGB(0.85, 0.05, 0.05)
    
    # P O No.
    po_text = "BSTSPO260300029-Location-1"
    c.drawString(stamp_x + 68, stamp_y + stamp_h * 0.675, po_text)
    
    # ITEM No.
    item_text = "17"
    c.drawString(stamp_x + 72, stamp_y + stamp_h * 0.490, item_text)
    
    # QTY
    qty_text = "8 Ea"
    c.drawString(stamp_x + 50, stamp_y + stamp_h * 0.300, qty_text)
    
    # Sign (in dark ink navy)
    c.setFont('Helvetica-BoldOblique', 8.5)
    c.setFillColorRGB(0.05, 0.15, 0.5)
    c.drawString(stamp_x + 148, stamp_y + stamp_h * 0.300, "MSG/QC-04")
    
    c.showPage()
    c.save()
    
    doc = fitz.open('test_stamped_mtc.pdf')
    pix = doc[0].get_pixmap(dpi=150)
    pix.save('test_stamped_mtc_preview.png')
    print("Updated test_stamped_mtc_preview.png successfully!")

generate_test_stamped_mtc()
