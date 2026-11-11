import os
import json
import re
import pdfplumber
from pypdf import PdfReader

def load_master_suppliers():
    json_path = os.path.join(os.path.dirname(__file__), 'static', 'suppliers.json')
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

MASTER_SUPPLIERS = load_master_suppliers()

COMMON_ITEM_WORDS = {
    "THREADOLET", "SPECTACLE", "UNION", "ELBOW", "FLANGE", "GASKET",
    "NIPPOLET", "WELDOLET", "SOCKOLET", "VALVE", "REDUCER", "COUPLING",
    "NIPPLE", "PIPE", "STUD", "BOLT", "NUT", "BLEED", "ORIFICE",
    "INSULATING", "SWAGELOK", "NEEDLE", "TEE", "CAP", "CROSS", "BUSHING", "PLUG"
}

REMARK_PATTERN = re.compile(
    r"\b(machined?(?:\s+from)?|machining|modified?(?:\s+from)?|mod(?:\s+from)?|offered?|made\s+from|fabricated?(?:\s+from)?|fab(?:\.|\s+from|\b)|fabrication|locally)\b.*",
    re.IGNORECASE
)

MAKE_MAPPINGS = [
    (r"JD[-_]?STOCK|\bDELCORTE\b|MEGA\/JD", "DELCORTE FRANCE"),
    (r"BENKAN\/TK|\bBENKAN\b", "BENKAN THAILAND"),
    (r"\bBOTHWELL\b", "BOTHWELL TAIWAN"),
    (r"\bCHERO\b|\bCHERO\s+PIPING\b|\bCHERO\s+FORGED\b|\bCHERO\s*F\b", "CHERO ITALY"),
    (r"\bBONNEY\s+FORGE\b", "BONNEY FORGE USA"),
    (r"\bPROMAT\b", "PROMAT UK"),
    (r"OMSA[-_]?STOCK|\bOMSA\b", "OMSA GERMANY"),
    (r"W[-_]?STOCK|WMA?ASS", "WMASS GERMANY"),
    (r"TK[-_]?STOCK|\bTK\b", "TK KOREA"),
    (r"ST&H(?:[-_]?STOCK)?|\bSTH\b", "ST&H KOREA"),
    (r"\bMFF\b|METALFAR", "Metalfar Italy"),
    (r"\bULMA\b", "ULMA SPAIN"),
    (r"\bMELESI\b", "MELESI ITALY"),
    (r"\bMEGA\b", "MEGA ITALY"),
    (r"\bRACCORTUBI\b", "RACCORTUBI ITALY"),
    (r"\bKITZ\b", "KITZ JAPAN"),
    (r"\bVALVEWORKS\b", "VALVEWORKS USA"),
    (r"\bSEGYUNG\b", "SEGYUNG KOREA"),
]

def auto_detect_make(raw_text):
    """
    Auto-detects manufacturer / MAKE name from raw item description, product code, or remarks.
    """
    if not raw_text:
        return ""
    for pattern, make_val in MAKE_MAPPINGS:
        if re.search(pattern, raw_text, re.IGNORECASE):
            return make_val
    return ""

def auto_detect_country_of_origin(make_text="", desc_text="", remarks_text=""):
    """
    Auto-detects Country of Origin (COO) for CIPL from MAKE, remarks, or description.
    """
    text = f"{make_text} {desc_text} {remarks_text}".upper()
    if re.search(r"\b(FRANCE|DELCORTE)\b", text):
        return "France"
    if re.search(r"\b(GERMANY|OMSA|WMASS|WMAASS)\b", text):
        return "Germany"
    if re.search(r"\b(ITALY|ITALIAN|METALFAR|MFF|MELESI|MEGA|RACCORTUBI|AR\s*ITALY)\b", text) or "ITAL" in text:
        return "Italy"
    if re.search(r"\b(KOREA|TK|ST&H|STH|SEGYUNG)\b", text):
        return "South Korea"
    if re.search(r"\b(THAILAND|BENKAN)\b", text):
        return "Thailand"
    if re.search(r"\b(SPAIN|ULMA)\b", text):
        return "Spain"
    if re.search(r"\b(TAIWAN)\b", text):
        return "Taiwan"
    if re.search(r"\b(USA|UNITED STATES|VALVEWORKS)\b", text):
        return "USA"
    if re.search(r"\b(UK|UNITED KINGDOM|ENGLAND|PROMAT)\b", text):
        return "United Kingdom"
    if re.search(r"\b(JAPAN|KITZ)\b", text):
        return "Japan"
    if re.search(r"\b(INDIA)\b", text):
        return "India"
    if re.search(r"\b(CHINA)\b", text):
        return "China"
    if re.search(r"\b(UAE|UNITED ARAB EMIRATES|DUBAI)\b", text):
        return "UAE"
    if "METALFAR" in text or "ITAL" in text:
        return "Italy"
    if "DELCORTE" in text:
        return "France"
    return "Italy"


def auto_detect_hs_code(desc_text=""):
    """
    Auto-detects HS Tariff Code for CIPL export based on product fitting category.
    """
    if not desc_text:
        return "7307.93.00"
    text = desc_text.upper()
    if re.search(r"\b(FLANGE|WNRF|BLIND|SPECTACLE|SLIP-ON|SO\s*FLANGE|SW\s*FLANGE|RTJ\s*FLANGE)\b", text):
        if re.search(r"\b(316|316L|304|304L|SS|STAINLESS|INCONEL|DUPLEX|SUPER DUPLEX)\b", text):
            return "7307.21.00"
        return "7307.91.00"
    if re.search(r"\b(ELBOW|TEE|REDUCER|CAP|CROSS|ECC\.?\s*RED|CONC\.?\s*RED|BEND)\b", text):
        if re.search(r"\b(316|316L|304|304L|SS|STAINLESS)\b", text):
            return "7307.23.00"
        return "7307.93.00"
    if re.search(r"\b(SWAGE|NIPPLE|COUPLING|UNION|WELDOLET|SOCKOLET|THREADOLET|NIPPOLET|LATROLET|BUSHING|PLUG|OLET)\b", text):
        if re.search(r"\b(316|316L|304|304L|SS|STAINLESS)\b", text):
            return "7307.29.00"
        return "7307.92.00"
    if re.search(r"\b(PIPE|TUBE|SMLS|TUBING)\b", text):
        if re.search(r"\b(316|316L|304|304L|SS|STAINLESS)\b", text):
            return "7304.41.00"
        return "7304.19.00"
    if re.search(r"\b(VALVE|BALL VALVE|CHECK VALVE|GATE VALVE|GLOBE VALVE|NEEDLE VALVE|BUTTERFLY)\b", text):
        return "8481.80.00"
    if re.search(r"\b(GASKET|SPIRAL WOUND|INSULATION KIT|RING JOINT)\b", text):
        return "6812.99.00"
    if re.search(r"\b(STUD|BOLT|NUT|FASTENER|WASHER)\b", text):
        return "7318.15.00"
    return "7307.93.00"

def strip_leading_item_number(description, sl_no=None):
    """
    Strips leading item sequence numbers (e.g. '1 ', '2 ', '1. ', '01 ') from the beginning of descriptions,
    while preserving actual size measurements like '1"', '1/2"', '2"'.
    """
    if not description:
        return ""
    desc = description.strip()
    if sl_no is not None:
        pattern = rf"^0*{sl_no}\s*[\.\-]?\s+(?![\"\/])"
        desc = re.sub(pattern, "", desc, flags=re.IGNORECASE).strip()
    # Also strip generic leading index number if followed by dot/dash
    desc = re.sub(r"^\d{1,3}\s*[\.\-]\s+(?![\"\/])", "", desc).strip()
    return desc

def extract_product_code_and_desc(description):
    """
    Extracts the leading product code (e.g. TEE256KNPTA105JD-STOCK, LSNPL2515S160)
    and returns (product_code, remaining_description).
    Preserves standard fitting names (THREADOLET, SPECTACLE, UNION, ELBOW, etc.).
    """
    if not description:
        return "", ""
    desc = description.strip()
    tokens = desc.split(maxsplit=1)
    if tokens and len(tokens) > 1:
        first_token = tokens[0].strip()
        if first_token.upper() not in COMMON_ITEM_WORDS:
            if re.match(r"^[A-Z]{2,}[A-Z0-9\-_\/&]{3,45}$", first_token):
                return first_token, tokens[1].strip()
    return "", desc

def strip_internal_product_code(description):
    """
    Strips internal product codes like LBL25300RF, LTO156KA350LF2, LUN256KNPTA105N,
    XEL90250S40SRWPB, BL151500RF, EL90256KNPTA105JD-STOCK from the beginning of item descriptions.
    Preserves standard fitting names (THREADOLET, SPECTACLE, UNION, ELBOW, etc.).
    """
    _, clean_desc = extract_product_code_and_desc(description)
    return clean_desc

def clean_cell_text(v):
    if not v:
        return ""
    return str(v).replace("\n", " ").strip()

def _extract_items_from_tables(pdf):
    """
    Extracts line items using pdfplumber structured tables across all pages.
    Guarantees column isolation (#, description, client_po_item_no, qty, rate, amount)
    and seamlessly merges multi-page split descriptions.
    """
    rows = []
    for p in pdf.pages:
        tables = p.extract_tables()
        for t in tables:
            for r in t:
                cr = [clean_cell_text(c) for c in r]
                if any(cr):
                    rows.append(cr)
                    
    items = []
    current_item = None
    
    for r in rows:
        row_str = " ".join(r).lower()
        if "item & description" in row_str or ("client po" in row_str and "rate" in row_str):
            continue
        if re.search(r"\b(sub total|zero rate|total|standard rate)\b", row_str) and not re.search(r"\b(valve|gasket|bolt|flange|elbow|pipe|fitting)\b", row_str):
            continue
        if re.search(r"\b(duty|vat|tax)\s*\d+%", row_str):
            continue
            
        non_empty = [c for c in r if c]
        if not non_empty:
            continue
            
        # Ignore standalone page number rows e.g. ['2'] or ['3', '', '']
        if len(non_empty) == 1 and re.match(r"^\d{1,3}$", non_empty[0]):
            continue
            
        # Check if first non-empty cell is an item sequence number (1, 2, ..., 24, etc.)
        first_col_num = None
        sl_col_idx = -1
        for idx, col_val in enumerate(r):
            if re.match(r"^[1-9]\d{0,2}$", col_val):
                num = int(col_val)
                rem_c = [c for c in r[idx + 1:] if c]
                if rem_c:
                    first_col_num = num
                    sl_col_idx = idx
                    break
                
        if first_col_num is not None and sl_col_idx >= 0:
            rem_cells = [c for c in r[sl_col_idx + 1:] if c]
            
            # Filter out duty/vat rows that have a number
            combined_rem = " ".join(rem_cells).lower()
            if re.search(r"\b(duty|vat|tax)\s*\d+%", combined_rem):
                continue
                
            if current_item:
                items.append(current_item)
                current_item = None
                
            desc = ""
            client_po_no = str(first_col_num)
            qty = "1.00"
            uom = "pcs"
            rate = ""
            amount = ""
            
            if len(rem_cells) == 1:
                if re.search(r"[\d,]+\.\d{2}", rem_cells[0]):
                    amount = rem_cells[0]
                else:
                    desc = rem_cells[0]
            elif len(rem_cells) >= 2:
                amount = rem_cells[-1] if re.search(r"[\d,]+\.\d{2}", rem_cells[-1]) else ""
                rate = rem_cells[-2] if len(rem_cells) >= 2 and re.search(r"[\d,]+\.\d{2}", rem_cells[-2]) else ""
                
                remaining = rem_cells[:-2] if (amount and rate) else rem_cells[:-1]
                
                if remaining and re.search(r"\d+(?:\.\d+)?", remaining[-1]):
                    qty_raw = remaining[-1]
                    remaining = remaining[:-1]
                    
                    qty_m = re.search(r"([\d,]+(?:\.\d+)?)", qty_raw)
                    if qty_m:
                        qty = qty_m.group(1).replace(",", "")
                    uom_m = re.search(r"\b(pcs|ea|set|mtr|nos|pkg|m|kg|box|pallet)\b", qty_raw, re.I)
                    if uom_m:
                        uom = uom_m.group(1).lower()
                        
                if remaining and re.match(r"^\d{1,8}$", remaining[0]):
                    client_po_no = remaining[0]
                    remaining = remaining[1:]
                elif remaining and re.match(r"^\d{1,8}$", remaining[-1]):
                    client_po_no = remaining[-1]
                    remaining = remaining[:-1]
                    
                desc = " ".join(remaining).strip()
                
            current_item = {
                "sl_no": first_col_num,
                "client_po_item_no": client_po_no,
                "description": desc,
                "qty": qty,
                "uom": uom,
                "rate": rate,
                "amount": amount,
                "remarks": "",
                "make": "",
                "supplier_name": "",
                "supplier_po": "",
                "package_type": "Pallet",
                "package_no": "1"
            }
        else:
            if current_item:
                extra_desc = " ".join(non_empty).strip()
                if extra_desc and not re.search(r"\b(sub total|total|vat|duty)\b", extra_desc.lower()):
                    if current_item["description"]:
                        current_item["description"] = (current_item["description"] + " " + extra_desc).strip()
                    else:
                        current_item["description"] = extra_desc

    if current_item:
        items.append(current_item)

    return items

def _extract_items_from_text(lines):
    """
    Fallback text-based line parser for unstructured or unbordered PDFs.
    """
    items = []
    item_pattern = re.compile(r"^([1-9]\d{0,2})\s+(.+)")
    in_items = False
    current_item = None

    for i, line in enumerate(lines):
        if re.search(r"#\s*Item\s*&\s*Description", line, re.IGNORECASE):
            in_items = True
            continue
        
        if in_items and re.search(r"Sub\s*Total|Standard\s*Rate|Total|VAT", line, re.IGNORECASE):
            if current_item:
                items.append(current_item)
                current_item = None
            break

        if in_items:
            m = item_pattern.match(line)
            if m:
                rest_txt = m.group(2).strip()
                # Check if this line is actually a continuation line that happens to start with a number like "300 LBS" or "316 BALL"
                if re.match(r"^(?:300|150|600|900|1500|2500)\s*(?:LBS|#|PSI|RF|RTJ|SCH)", rest_txt, re.I) or re.match(r"^(?:316|304|316L|304L|A105|LF2|WCB)\s*(?:BALL|STEM|BODY|TRIM|INSERT)", rest_txt, re.I):
                    if current_item:
                        current_item["description"] += " " + line
                        continue

                if current_item:
                    items.append(current_item)
                    current_item = None

                sl_no = m.group(1)
                rest = m.group(2)
                
                num_pattern = re.compile(r"([\d,]+\.\d{2})")
                matches = list(num_pattern.finditer(rest))

                qty = "1.00"
                uom = "pcs"
                description = rest
                rate = ""
                amount = ""

                client_po_item_no = str(sl_no)
                if len(matches) >= 2:
                    rate = matches[-2].group(1)
                    amount = matches[-1].group(1)
                    rate_idx = matches[-2].start()
                    desc_part = rest[:rate_idx].strip()
                    
                    sub_tokens = desc_part.split()
                    for idx in range(len(sub_tokens) - 1, -1, -1):
                        token = sub_tokens[idx]
                        if re.match(r"^\d+(?:\.\d+)?$", token):
                            qty = token
                            if idx + 1 < len(sub_tokens) and not re.match(r"^\d+$", sub_tokens[idx + 1]):
                                uom = sub_tokens[idx + 1]
                            
                            desc_sub = sub_tokens[:idx]
                            if desc_sub and re.match(r"^\d{1,8}$", desc_sub[0]):
                                client_po_item_no = desc_sub[0]
                                desc_sub = desc_sub[1:]
                            elif desc_sub and re.match(r"^\d{1,8}$", desc_sub[-1]):
                                client_po_item_no = desc_sub[-1]
                                desc_sub = desc_sub[:-1]
                            
                            description = " ".join(desc_sub)
                            break

                current_item = {
                    "sl_no": int(sl_no),
                    "client_po_item_no": client_po_item_no,
                    "description": description.strip(),
                    "qty": qty if qty else "1.00",
                    "uom": uom if uom else "pcs",
                    "rate": rate,
                    "amount": amount,
                    "heat_number": "",
                    "certificate_number": "",
                    "make": "",
                    "remarks": "",
                    "supplier_name": "",
                    "supplier_po": "",
                    "package_type": "Pallet",
                    "package_no": "1"
                }
            else:
                if current_item:
                    if not re.search(r"Sub\s*Total|Standard\s*Rate|Total|VAT|Page|\d+\s*of\s*\d+", line, re.IGNORECASE):
                        if re.match(r"^[\d\s.,pcsEAea\/]+$", line) and re.search(r"\d+\.\d{2}", line):
                            uom_m = re.search(r"\b(pcs|ea|set|mtr|nos|pkg)\b", line, re.IGNORECASE)
                            if uom_m and not current_item["uom"]:
                                current_item["uom"] = uom_m.group(1).lower()
                            continue

                        clean_line = line
                        uom_match = re.search(r"\b(pcs|ea|set|mtr|nos|pkg)\b", clean_line, re.IGNORECASE)
                        if uom_match:
                            if not current_item["uom"]:
                                current_item["uom"] = uom_match.group(1).lower()
                            clean_line = re.sub(r"\b(pcs|ea|set|mtr|nos|pkg)\b", "", clean_line, flags=re.IGNORECASE).strip()
                        
                        if clean_line and not re.match(r"^\d{4,5}$", clean_line):
                            rem_m = REMARK_PATTERN.search(clean_line)
                            if rem_m:
                                remark_txt = rem_m.group(0).strip()
                                if current_item["remarks"]:
                                    current_item["remarks"] += "; " + remark_txt
                                else:
                                    current_item["remarks"] = remark_txt
                                
                                desc_part = REMARK_PATTERN.sub('', clean_line).rstrip(' -:,;')
                                if desc_part:
                                    current_item["description"] += " " + desc_part
                            else:
                                current_item["description"] += " " + clean_line

    if current_item:
        items.append(current_item)

    return items

def extract_pdf_data(pdf_path_or_file):
    """
    Extracts header metadata (Client, PO Number, MSG Ref) and line items
    from Sales Order / Purchase Order PDFs.
    Auto-detects supplier names from master list and machining instructions.
    """
    full_text = ""
    table_items = []
    try:
        with pdfplumber.open(pdf_path_or_file) as pdf:
            # Extract full text for headers
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
            
            # Primary: Extract structured tables
            table_items = _extract_items_from_tables(pdf)
    except Exception as e:
        print(f"pdfplumber error: {e}")

    if not full_text.strip() and isinstance(pdf_path_or_file, str):
        try:
            with open(pdf_path_or_file, 'r', encoding='utf-8', errors='ignore') as f:
                full_text = f.read()
        except Exception:
            pass

    lines = [line.strip() for line in full_text.splitlines() if line.strip()]

    # --- Header Parsing ---
    client = ""
    po_number = ""
    msg_ref = ""

    so_match = re.search(r"(?:Sales\s*Order\s*#|MSG\s*Ref\s*:?)\s*([A-Z0-9\-_]+)", full_text, re.IGNORECASE)
    if so_match:
        msg_ref = so_match.group(1).strip()

    po_match = re.search(r"(?:Ref\s*#\s*:?|PO\s*(?:Number|#)?\s*:?)\s*([A-Z0-9\-_]+)", full_text, re.IGNORECASE)
    if po_match:
        po_number = po_match.group(1).strip()

    client_match = re.search(r"(?:Bill\s*To|Client\s*:?)\s*\n?([^\n]+)", full_text, re.IGNORECASE)
    if client_match:
        raw_client = client_match.group(1).strip()
        raw_client = re.sub(r"-AED$", "", raw_client, flags=re.IGNORECASE).strip()
        client = raw_client

    # Choose table items if available, else fallback to text parser
    if table_items and len(table_items) > 0:
        items = table_items
    else:
        items = _extract_items_from_text(lines)

    # Post-process items to clean descriptions, auto-detect MAKE & suppliers
    for item in items:
        # Strip header leakage if any (e.g. "1 Client PO Item No")
        item["description"] = re.sub(r"\b\d+\s+Client\s+PO\s+Item\s+No\b", "", item["description"], flags=re.IGNORECASE).strip()
        item["description"] = re.sub(r"\bClient\s+PO\s+Item\s+No\b", "", item["description"], flags=re.IGNORECASE).strip()

        # Strip leading item sequence numbers e.g. "1 ECC. RED..." -> "ECC. RED..."
        item["description"] = strip_leading_item_number(item["description"], item["sl_no"])

        # Check if description begins with a Client PO Item Number (e.g. "10000 UNION..." or "10 FLANGE...")
        cpo_match = re.match(r"^(\d{1,8})\s+([A-Za-z].*)", item["description"])
        if cpo_match:
            cand_cpo = cpo_match.group(1)
            if not item.get("client_po_item_no") or str(item.get("client_po_item_no")) == str(item.get("sl_no")):
                item["client_po_item_no"] = cand_cpo
                item["description"] = cpo_match.group(2).strip()
            elif cand_cpo == str(item.get("client_po_item_no")):
                item["description"] = cpo_match.group(2).strip()

        # 1. Extract product code strictly from the beginning of description
        product_code, clean_desc = extract_product_code_and_desc(item["description"])
        if product_code:
            item["product_code"] = product_code
            item["description"] = clean_desc
        else:
            item["product_code"] = ""

        # 2. Check MAKE from product code, description, or remarks
        if not item.get("make"):
            detected_make = auto_detect_make(f"{item.get('product_code', '')} {item.get('description', '')} {item.get('remarks', '')}")
            if detected_make:
                item["make"] = detected_make

        # Check if product code or description contains STOCK
        if item.get("product_code") and re.search(r"[-_\s/]?STOCK\b", item["product_code"], re.IGNORECASE):
            item["supplier_name"] = "STOCK"
        elif not item.get("supplier_name") and re.search(r"[-_\s/]?STOCK\b", item.get("description", ""), re.IGNORECASE):
            item["supplier_name"] = "STOCK"
        elif not item.get("supplier_name"):
            item["supplier_name"] = ""

        # 3. Check if description itself contains remark patterns
        rem_match = REMARK_PATTERN.search(item["description"])
        if rem_match:
            remark_text = rem_match.group(0).strip()
            cleaned_desc = REMARK_PATTERN.sub('', item["description"]).rstrip(' -:,;')
            item["description"] = cleaned_desc
            if item.get("remarks"):
                if remark_text.lower() not in item["remarks"].lower():
                    item["remarks"] += "; " + remark_text
            else:
                item["remarks"] = remark_text

        # Strip leading item number again if revealed after code stripping
        item["description"] = strip_leading_item_number(item["description"], item["sl_no"])

        # Ensure default packaging & CIPL fields
        if not item.get("package_type"):
            item["package_type"] = "Pallet"
        if not item.get("package_no"):
            item["package_no"] = "1"
        if "heat_number" not in item:
            item["heat_number"] = ""
        if "certificate_number" not in item:
            item["certificate_number"] = ""
        if not item.get("country_of_origin"):
            item["country_of_origin"] = auto_detect_country_of_origin(item.get("make", ""), item.get("description", ""))
        if not item.get("hs_code"):
            item["hs_code"] = auto_detect_hs_code(item.get("description", ""))

    # Group items by client_po_item_no to auto-detect split batches (e.g. 14 pcs stock & 26 pcs local market -> 14 OF 40 & 26 OF 40)
    from collections import defaultdict
    client_groups = defaultdict(list)
    for it in items:
        c_no = str(it.get("client_po_item_no", "")).strip()
        if c_no:
            client_groups[c_no].append(it)

    for c_no, grp in client_groups.items():
        if len(grp) > 1:
            total_qty = 0.0
            for it in grp:
                raw_q = str(it.get("qty", "1")).replace(",", "").strip()
                m = re.match(r"^([\d.]+)", raw_q)
                if m:
                    total_qty += float(m.group(1))
            
            fmt_total = int(total_qty) if total_qty.is_integer() else round(total_qty, 2)
            
            for it in grp:
                raw_q = str(it.get("qty", "1")).replace(",", "").strip()
                m = re.match(r"^([\d.]+)", raw_q)
                curr_q = float(m.group(1)) if m else 1.0
                fmt_curr = int(curr_q) if curr_q.is_integer() else round(curr_q, 2)
                it["qty"] = f"{fmt_curr} OF {fmt_total}"
                it["total_qty"] = fmt_total
                it["group_id"] = f"grp-{c_no}"

    # Detect currency
    currency = "USD"
    if re.search(r"\b(?:AED|Dhs|Dirham)\b", full_text, re.IGNORECASE) or "-AED" in full_text:
        currency = "AED"
    elif re.search(r"\b(?:USD|\$|Dollar)\b", full_text, re.IGNORECASE):
        currency = "USD"
    elif re.search(r"\b(?:SAR|SR|Riyal)\b", full_text, re.IGNORECASE):
        currency = "SAR"
    elif re.search(r"\b(?:EUR|Euro|€)\b", full_text, re.IGNORECASE):
        currency = "EUR"

    return {
        "client": client,
        "po_number": po_number,
        "msg_ref": msg_ref,
        "currency": currency,
        "items": items
    }

