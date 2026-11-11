import pypdf

reader = pypdf.PdfReader(r'C:\Users\Admin\.gemini\antigravity\brain\5071eec3-c7f2-4e0b-9bbe-868be8a229b9\.user_uploaded\media_1794379974390.pdf')
p0 = reader.pages[0]

def visitor_body(text, cm, tm, font_dict, font_size):
    if text.strip():
        bf = font_dict.get('/BaseFont', '') if font_dict else ''
        print(f"Text: {repr(text)} | Pos: ({tm[4]:.2f}, {tm[5]:.2f}) | Font: {bf} | Size: {font_size}")

print("--- PAGE 0 TEXT ---")
p0.extract_text(visitor_text=visitor_body)
print("\n--- IMAGES ---")
for img in p0.images:
    print("Image:", img.name)
