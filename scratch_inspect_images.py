import pdfplumber

with pdfplumber.open(r'C:\Users\Admin\.gemini\antigravity\brain\5071eec3-c7f2-4e0b-9bbe-868be8a229b9\.user_uploaded\media_1794379974390.pdf') as pdf:
    p0 = pdf.pages[0]
    print("Page width:", p0.width, "height:", p0.height)
    print("Images found:", len(p0.images))
    for i, img in enumerate(p0.images):
        print(f"Img {i}: x0={img['x0']:.2f}, y0={img['y0']:.2f}, x1={img['x1']:.2f}, y1={img['y1']:.2f}, w={img['width']:.2f}, h={img['height']:.2f}")

    print("\nMetadata:", pdf.metadata)
