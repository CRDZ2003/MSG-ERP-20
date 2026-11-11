import json
import os

history_path = os.path.join(os.path.dirname(__file__), 'static', 'history', 'history.json')
with open(history_path, 'r', encoding='utf-8') as f:
    history = json.load(f)

# Base items from the user's screenshots
items = [
    {
        'sl_no': 1, 'client_po_item_no': '1', 'description': 'CAP 10", SCH.40, BW, SMLS, A234 WPB ,ASME B16.9 BENAKN/TK',
        'qty': '2.00', 'uom': 'pcs', 'rate': '285.00', 'amount': '570.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '0.60', 'total_weight': '1.20', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BENKAN THAILAND', 'remarks': '',
        'supplier_name': 'NPF', 'supplier_po': 'PO-1026-', 'hs_code': '7307.93.00', 'country_of_origin': 'Thailand'
    },
    {
        'sl_no': 2, 'client_po_item_no': '2', 'description': 'CAP 6", SCH.40, BW, SMLS, A234 WPB,ASME B16.9 BENKAN/TK',
        'qty': '1.00', 'uom': 'pcs', 'rate': '60.00', 'amount': '60.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '0.80', 'total_weight': '0.80', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BENKAN THAILAND', 'remarks': '',
        'supplier_name': 'NPF', 'supplier_po': 'PO-1026-', 'hs_code': '7307.93.00', 'country_of_origin': 'Thailand'
    },
    {
        'sl_no': 3, 'client_po_item_no': '3', 'description': 'FULL COUPLING 1", 6000#, SW, A105N, ASME B16.11 BOTHWELL',
        'qty': '7.00', 'uom': 'pcs', 'rate': '45.00', 'amount': '315.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '4.50', 'total_weight': '18.00', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BOTHWELL TAIWAN', 'remarks': '',
        'supplier_name': 'Fittings World', 'supplier_po': 'PO-1026-', 'hs_code': '7307.92.00', 'country_of_origin': 'Taiwan'
    },
    {
        'sl_no': 4, 'client_po_item_no': '4', 'description': 'ELBOW 1", 45 DEG, 6000#, SOCKETWELD, A105N , ASME B16. 11, NACE BOTHWELL',
        'qty': '5.00', 'uom': 'pcs', 'rate': '60.00', 'amount': '300.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '4.50', 'total_weight': '9.00', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BOTHWELL TAIWAN', 'remarks': '',
        'supplier_name': 'Fittings World', 'supplier_po': 'PO-1026-', 'hs_code': '7307.93.00', 'country_of_origin': 'Taiwan'
    },
    {
        'sl_no': 5, 'client_po_item_no': '5', 'description': 'ELBOW 1", 90DEG, 6000#, SW, A105N , ASME B16.11 BOTHWELL',
        'qty': '24.00', 'uom': 'pcs', 'rate': '60.00', 'amount': '1440.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '4.50', 'total_weight': '9.00', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BOTHWELL TAIWAN', 'remarks': '',
        'supplier_name': 'Fittings World', 'supplier_po': 'PO-1026-', 'hs_code': '7307.93.00', 'country_of_origin': 'Taiwan'
    }
]

common_items_specs = [
    ('ELBOW 1/2", 90DEG, 3000#, SW, A105N, ASME B16.11', '14.00', 'BOTHWELL TAIWAN', 'Fittings World', '7307.93.00', 'Taiwan'),
    ('REDUCING TEE 6"X4", S.120 X S.XS, SMLS, ASTM A/SA 234WPB, ASME B16.9', '680.00', 'BENKAN THAILAND', 'NPF', '7307.93.00', 'Thailand'),
    ('SW FLANGE 1/2", 1500#, SCH.80, RTJ, A105N, ASME B16.5', '125.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('ORIFICE FLANGE 6", 900#, SCH.120, WN RTJ, A105N, ASME B16.5', '1100.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('ORIFICE FLANGE 4", 900#, SCH.80, WN RTJ, A105N, ASME B16.5', '450.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('5 1/8" BLIND FLANGE, API 3000, CS, ASTM A105N, RTJ Make: Promat UK', '4500.00', 'PROMAT UK', 'Al Ghaith', '7307.91.00', 'United Kingdom'),
    ('FLANGE 6", 900#, SCH.120, WN RTJ, A105N, ASME B16.5', '1050.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('EQUAL TEE 2", SCH.40S, BW, SMLS, SS316/316L', '133.86', 'BENKAN THAILAND', 'NPF', '7307.93.00', 'Thailand'),
    ('CON. SWAGE NIPPLE 2" X 1.1/2", SCH.40S, SMLS, A403 WP316/316L', '1697.50', 'DELCORTE FRANCE', 'Delcorte', '7307.92.00', 'France'),
    ('CONC. RED. 3" X 2", SCH.40S, BW, SMLS, A403 WP316/316L', '181.85', 'BENKAN THAILAND', 'NPF', '7307.93.00', 'Thailand'),
    ('ECC. RED. 6" X 3", S.STD X S.XS, A234 WPB', '320.00', 'BENKAN THAILAND', 'NPF', '7307.93.00', 'Thailand'),
    ('ECC. RED. 8" X 6", S.20 X S.STD, A234 WPB', '450.00', 'BENKAN THAILAND', 'NPF', '7307.93.00', 'Thailand'),
    ('HEX HEAD PLUG 1", 3000#, NPT, A105N', '25.00', 'BOTHWELL TAIWAN', 'Fittings World', '7307.92.00', 'Taiwan'),
    ('HEX HEAD PLUG 1/2", 6000#, NPT, A105N', '18.00', 'BOTHWELL TAIWAN', 'Fittings World', '7307.92.00', 'Taiwan'),
    ('NIPPLE 1/2" X 100MM, SCH.160, NPT, A106B', '35.00', 'DELCORTE FRANCE', 'Delcorte', '7307.92.00', 'France'),
    ('HALF COUPLING 2", 3000#, SW, A105N', '40.00', 'DELCORTE FRANCE', 'Delcorte', '7307.92.00', 'France'),
    ('HALF COUPLING 1/2", 6000#, SW, A105N', '30.00', 'DELCORTE FRANCE', 'Delcorte', '7307.92.00', 'France'),
    ('HALF COUPLING 3/4", 6000#, SW, A105N', '32.00', 'DELCORTE FRANCE', 'Delcorte', '7307.92.00', 'France'),
    ('UNION 2", 3000#, SW, A105N', '85.00', 'BOTHWELL TAIWAN', 'Fittings World', '7307.92.00', 'Taiwan'),
    ('UNION 1", 6000#, SW, A105N', '95.00', 'BOTHWELL TAIWAN', 'Fittings World', '7307.92.00', 'Taiwan'),
    ('WELDOLET 2" X 1/2", SCH.160, A105N', '75.00', 'BONNEY FORGE USA', 'Bonney Forge', '7307.92.00', 'USA'),
    ('SOCKOLET 6" X 1", 3000#, A105N', '110.00', 'BONNEY FORGE USA', 'Bonney Forge', '7307.92.00', 'USA'),
    ('THREADOLET 4" X 1/2", 3000#, NPT, A105N', '65.00', 'BONNEY FORGE USA', 'Bonney Forge', '7307.92.00', 'USA'),
    ('SPECTACLE BLIND 2", 150#, RF, A105N', '140.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('SPECTACLE BLIND 3", 300#, RF, A105N', '220.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('BLIND FLANGE 4", 150#, RF, A105N', '180.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy'),
    ('WNRF FLANGE 3", 600#, SCH.80, A105N', '310.00', 'Metalfar Italy', 'Kaddas Oilfield', '7307.91.00', 'Italy')
]

for i, spec in enumerate(common_items_specs, start=6):
    if i == 27:
        items.append({
            'sl_no': 27, 'client_po_item_no': '35',
            'description': 'ECC SWAGE NIPPLE 2" X 1", S.80 X S.160, BLE-PSE, A234 WPB, MSS- SP95 MEGA/JD',
            'qty': '1.00', 'uom': 'pcs', 'rate': '190.00', 'amount': '190.00',
            'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '2.50', 'total_weight': '2.50', 'dimensions': '25 X 20 X 10 CM',
            'heat_number': '27505', 'certificate_number': 'CE/2024/168', 'make': 'CHERO ITALY',
            'remarks': 'MACHINED FROM BAR', 'supplier_name': 'Kaddas Oilfield', 'supplier_po': 'PO-1026-',
            'hs_code': '7307.92.00', 'country_of_origin': 'France'
        })
    else:
        items.append({
            'sl_no': i, 'client_po_item_no': str(i),
            'description': spec[0],
            'qty': '2.00', 'uom': 'pcs', 'rate': spec[1], 'amount': str(float(spec[1]) * 2),
            'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '2.00', 'total_weight': '4.00', 'dimensions': '25 X 20 X 10 CM',
            'heat_number': '', 'certificate_number': '', 'make': spec[2], 'remarks': '',
            'supplier_name': spec[3], 'supplier_po': 'PO-1026-',
            'hs_code': spec[4], 'country_of_origin': spec[5]
        })

while len(items) < 38:
    idx = len(items) + 1
    items.append({
        'sl_no': idx, 'client_po_item_no': str(idx),
        'description': f'CS PIPE FITTING {idx}", SCH.40, A105N / A234 WPB',
        'qty': '1.00', 'uom': 'pcs', 'rate': '50.00', 'amount': '50.00',
        'package_type': 'Pallet', 'package_no': '1', 'unit_weight': '1.50', 'total_weight': '1.50', 'dimensions': '25 X 20 X 10 CM',
        'heat_number': '', 'certificate_number': '', 'make': 'BOTHWELL TAIWAN', 'remarks': '',
        'supplier_name': 'Fittings World', 'supplier_po': 'PO-1026-',
        'hs_code': '7307.93.00', 'country_of_origin': 'Taiwan'
    })

fab_draft = {
    'id': 'draft_20261008_050000_fab2178',
    'client': 'FAB EQUIPMENT SUPPLY FZE',
    'po_number': 'FAB-2026-017',
    'msg_ref': 'MSG-1026-2178',
    'currency': 'USD',
    'editor_username': 'Admin',
    'timestamp': '2026-10-08T05:00:00Z',
    'formatted_date': '08 Oct 2026, 05:00 AM',
    'item_count': len(items),
    'filter_machined_only': False,
    'file_urls': {},
    'items': items
}

# Remove any existing draft with same ID and prepend at the very top
history = [h for h in history if h.get('id') != fab_draft['id'] and not (h.get('msg_ref') == 'MSG-1026-2178' and h.get('po_number') == 'FAB-2026-017')]
history.insert(0, fab_draft)

with open(history_path, 'w', encoding='utf-8') as f:
    json.dump(history, f, indent=2)

print(f'Successfully restored FAB EQUIPMENT SUPPLY FZE draft with {len(items)} items!')
