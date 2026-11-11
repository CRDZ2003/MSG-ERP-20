import fitz
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import io

# 1. Create a 2-page sample MTC
buffer = io.BytesIO()
c = canvas.Canvas(buffer, pagesize=A4)
# Page 1
c.setFont('Helvetica-Bold', 14)
c.drawString(50, 800, 'SAMPLE MILL TEST CERTIFICATE - EN 10204 3.1')
c.setFont('Helvetica', 10)
c.drawString(50, 780, 'Heat: 67M01M085 | Item: 2 in SCH160 90 DEG LR ELBOW')
c.drawString(50, 750, 'Chemical Analysis: C: 0.12%, Mn: 0.85%, Si: 0.22%, P: 0.015%, S: 0.008%')
c.drawString(50, 730, 'Mechanical Properties: Yield: 345 MPa, Tensile: 512 MPa, Elongation: 32%')
c.showPage()
# Page 2
c.setFont('Helvetica-Bold', 14)
c.drawString(50, 800, 'PAGE 2 - SUPPLEMENTARY NON-DESTRUCTIVE TESTING AND IMPACT TEST')
c.setFont('Helvetica', 10)
c.drawString(50, 780, 'Impact Testing at -46 deg C: 48J, 52J, 50J (Average 50J)')
c.drawString(50, 750, 'Ultrasonic Test (UT): Satisfactory | Magnetic Particle (MT): Satisfactory')
c.showPage()
c.save()

raw_pdf = buffer.getvalue()

# Open with PyMuPDF and apply stamps
doc = fitz.open('pdf', raw_pdf)

# Page 1: Rectangular Seal
page1 = doc[0]
rect_seal = r'C:\Users\Admin\.gemini\antigravity\scratch\msg-oilfield-erp\public\assets\seal_transparent.png'
rect_box = fitz.Rect(350, 681.4, 560, 787.0)
page1.insert_image(rect_box, filename=rect_seal)

page1.insert_text((350 + 68, 715.7), 'BSTSPO260300029-Location-1', fontname='helv', fontsize=8.5, color=(0.85, 0.05, 0.05))
page1.insert_text((350 + 72, 735.3), '17', fontname='helv', fontsize=8.5, color=(0.85, 0.05, 0.05))
page1.insert_text((350 + 50, 755.3), '8 Ea', fontname='helv', fontsize=8.5, color=(0.85, 0.05, 0.05))
page1.insert_text((350 + 148, 755.3), 'MSG/QC-04', fontname='helv', fontsize=8.5, color=(0.05, 0.15, 0.5))

# Page 2: Round Seal
page2 = doc[1]
round_seal = r'C:\Users\Admin\.gemini\antigravity\scratch\msg-oilfield-erp\public\assets\seal_round_transparent.png'
round_box = fitz.Rect(430, 662, 560, 792)
page2.insert_image(round_box, filename=round_seal)

# Sign baseline
page2.insert_text((489.8, 753.26), 'MSG/QC-04', fontname='helv', fontsize=8.5, color=(0.05, 0.15, 0.5))

doc.save(r'C:\Users\Admin\.gemini\antigravity\scratch\msg-oilfield-erp\test_multipage_stamped.pdf')

pix1 = page1.get_pixmap(dpi=150)
pix1.save(r'C:\Users\Admin\.gemini\antigravity\scratch\msg-oilfield-erp\test_page1_preview.png')
pix2 = page2.get_pixmap(dpi=150)
pix2.save(r'C:\Users\Admin\.gemini\antigravity\scratch\msg-oilfield-erp\test_page2_preview.png')
print('SUCCESS_MULTIPAGE_SEAL')
