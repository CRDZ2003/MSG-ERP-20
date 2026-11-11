import os
from reportlab.lib.pagesizes import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

# 58 mm x 39 mm
PAGE_WIDTH = 58 * mm   # 164.4094
PAGE_HEIGHT = 39 * mm  # 110.5512

def generate_sample():
    c = canvas.Canvas('test_output_sticker.pdf', pagesize=(PAGE_WIDTH, PAGE_HEIGHT))
    
    items = [
        {
            'client': 'STS Bahrain',
            'po': 'BSTSPO260300029-Location-1',
            'item_no': '17',
            'desc_lines': [
                '1.1/2" 90 DEGREE ELBOW, ASME',
                'B16.11, ASTM A105N, SW ENDS, 6000',
                'LBS'
            ],
            'qty': '8 Ea',
            'heat': 'EY7',
            'make': 'DELCORTE, FRANCE',
            'cert': '232442/3',
            'remarks': 'LOCATION-1'
        },
        {
            'client': 'STS Bahrain',
            'po': 'BSTSPO260300029-Location-1',
            'item_no': '27',
            'desc_lines': [
                '2" X SCH160, 90 DEGREE ELBOW LONG',
                'RADIUS (R=1.5D), SEAMLESS, ASME',
                'B16.9, ASTM A420 GR.WPL6, BW ENDS'
            ],
            'qty': '4 OF 10 Ea',
            'heat': '67M01M085',
            'make': 'BENKAN, THAILAND',
            'cert': 'T202511670073',
            'remarks': 'LOCATION-1'
        }
    ]

    for item in items:
        c.setFont('Times-Bold', 7.3)
        c.setFillColorRGB(0, 0, 0)
        
        # Header
        c.drawString(5.67, 97.58, item['client'])
        c.drawString(5.67, 89.19, f"PO Number: {item['po']}")
        c.drawString(5.67, 80.79, f"ITEM NO: {item['item_no']}")
        
        # Description
        y_desc = 69.48
        for line in item['desc_lines']:
            c.drawString(5.67, y_desc, line)
            y_desc -= 8.40
            
        # Specs
        c.drawString(5.67, 40.64, f"PO QTY: {item['qty']}")
        c.drawString(5.67, 32.25, f"HEAT NUMBER: {item['heat']}")
        c.drawString(5.67, 23.85, f"MAKE: {item['make']}")
        c.drawString(5.67, 15.46, f"CERTIFICATE NO: {item['cert']}")
        c.drawString(5.67, 7.06, f"Remarks: {item['remarks']}")
        
        # Logo
        if os.path.exists('public/logo.png'):
            c.drawImage('public/logo.png', 121.89, 86.46, width=34.02, height=19.84, mask='auto')
            
        # QR Code using built-in ReportLab QR
        qr_data = f"ITEM:{item['item_no']}|PO:{item['po']}|HEAT:{item['heat']}|MAKE:{item['make']}|QTY:{item['qty']}"
        qr_widget = qr.QrCodeWidget(qr_data)
        bounds = qr_widget.getBounds()
        w = bounds[2] - bounds[0]
        h = bounds[3] - bounds[1]
        d = Drawing(17.01, 17.01, transform=[17.01 / w, 0, 0, 17.01 / h, 0, 0])
        d.add(qr_widget)
        renderPDF.draw(d, c, 138.90, 5.67)
        
        c.showPage()
        
    c.save()
    print("Generated test_output_sticker.pdf successfully!")

generate_sample()
