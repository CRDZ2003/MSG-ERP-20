// Database Service for MSG Oilfield Equipment Trading LLC ERP
// Provides reactive state, relational consistency, transaction-safe allocation, cancellation, and dispatch

import {
  Item,
  StockLot,
  StockBalance,
  SalesOrder,
  MTCCertificate,
  LocalPurchaseRecord,
  StockMovement,
  ApprovalRecord,
  DispatchRecord,
  StockReturn,
  StockAdjustment,
  AuditLog,
  Customer,
  UserProfile,
  ExcelImportJob,
} from '../types'
import { uploadedCertificatesCache } from './certificateVault'

const STORAGE_KEY_PREFIX = 'msg_oilfield_v1_'

function loadFromStorage<T>(key: string, defaultVal: T): T {
  try {
    const item = localStorage.getItem(STORAGE_KEY_PREFIX + key)
    return item ? JSON.parse(item) : defaultVal
  } catch (e) {
    console.error('Failed to load ' + key, e)
    return defaultVal
  }
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save ' + key, e)
  }
}

// Initial Customers
const initialCustomers: Customer[] = [
  { id: 'CUST-001', customer_code: 'ADNOC', customer_name: 'ADNOC Refining & Petrochemicals', address: 'Abu Dhabi, UAE', contact_details: '+971 2 6020000', status: 'Active', created_at: '2026-01-10' },
  { id: 'CUST-002', customer_code: 'PETROFAC', customer_name: 'Petrofac Emirates LLC', address: 'Al Markaziyah, Abu Dhabi', contact_details: '+971 2 6265000', status: 'Active', created_at: '2026-01-15' },
  { id: 'CUST-003', customer_code: 'DUBAL', customer_name: 'Emirates Global Aluminium (DUBAL)', address: 'Jebel Ali, Dubai', contact_details: '+971 4 8846666', status: 'Active', created_at: '2026-02-01' },
  { id: 'CUST-004', customer_code: 'NPCC', customer_name: 'National Petroleum Construction Co (NPCC)', address: 'Mussafah, Abu Dhabi', contact_details: '+971 2 5549000', status: 'Active', created_at: '2026-02-10' },
  { id: 'CUST-005', customer_code: 'MCDERMOTT', customer_name: 'McDermott Middle East Inc', address: 'JAFZA, Dubai', contact_details: '+971 4 8835200', status: 'Active', created_at: '2026-03-01' },
  { id: 'CUST-006', customer_code: 'LAMPRELL', customer_name: 'Lamprell Energy Ltd', address: 'Hamriyah Free Zone, Sharjah', contact_details: '+971 6 5282323', status: 'Active', created_at: '2026-03-12' },
  { id: 'CUST-007', customer_code: 'ARCHIRODON', customer_name: 'Archirodon Construction (Overseas) Co', address: 'Al Barsha, Dubai', contact_details: '+971 4 4578000', status: 'Active', created_at: '2026-03-20' },
  { id: 'CUST-008', customer_code: 'DODSAL', customer_name: 'Dodsal Engineering & Construction', address: 'Deira, Dubai', contact_details: '+971 4 2824100', status: 'Active', created_at: '2026-04-05' },
  { id: 'CUST-009', customer_code: 'TARGET', customer_name: 'Target Engineering Construction Co', address: 'Mussafah, Abu Dhabi', contact_details: '+971 2 6714700', status: 'Active', created_at: '2026-04-18' },
  { id: 'CUST-010', customer_code: 'SNCLAVALIN', customer_name: 'SNC-Lavalin Middle East', address: 'Al Reem Island, Abu Dhabi', contact_details: '+971 2 4085000', status: 'Active', created_at: '2026-05-01' },
]

// Initial Master Items
const initialItems: Item[] = [
  { id: 'ITEM-001', item_code: 'WSO15150F316', item_description: '1/2" Flange SORF CL150 SS316/SS316L', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '1/2" #150', uom: 'PCS', unit_price_aed: 22.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-002', item_code: 'WSO20150F316', item_description: '3/4" Flange SORF CL150 SS316/SS316L', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '3/4" #150', uom: 'PCS', unit_price_aed: 32.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-003', item_code: 'WSO40150F316', item_description: '1 1/2" Flange SORF CL150 SS316/SS316L', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '1 1/2" #150', uom: 'PCS', unit_price_aed: 70.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-004', item_code: 'WSO30150F316', item_description: '1 1/4" Flange SORF CL150 SS316/SS316L', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '1 1/4" #150', uom: 'PCS', unit_price_aed: 70.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-005', item_code: 'EL9050S80WPBBENKAN-STOCK', item_description: 'ELBOW 2", 90DEG, SCH.80, LR, BW, SMLS, ASTM A234 WPB', material_grade: 'ASTM A234 WPB', specification: 'ASME B16.9', size: '2" Sch 80', uom: 'PCS', unit_price_aed: 26.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-006', item_code: 'EL9080S40WPBBENKAN-STOCK', item_description: 'ELBOW 3", 90DEG, SCH.40, LR, BW, SMLS, ASTM A234 WPB', material_grade: 'ASTM A234 WPB', specification: 'ASME B16.9', size: '3" Sch 40', uom: 'PCS', unit_price_aed: 48.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-007', item_code: 'WSO80150F316-LOC', item_description: '3" Flange SORF CL150 SS316/SS316L (Item #8 - Local Purchase)', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '3" #150', uom: 'PCS', unit_price_aed: 155.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-008', item_code: 'WSO100150F316-LOC', item_description: '4" Flange SORF CL150 SS316/SS316L (Item #9 - Local Purchase)', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '4" #150', uom: 'PCS', unit_price_aed: 195.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-009', item_code: 'WN15150S80RFA105SRI-STOCK', item_description: 'FLANGE 1/2", 150#, SCH.80, WNRF, SA105N, ASME B16.5', material_grade: 'ASTM A105N', specification: 'ASME B16.5', size: '1/2" #150', uom: 'PCS', unit_price_aed: 15.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-010', item_code: 'WN150150S80RFA105GB-STOCK', item_description: 'WNRF 6", 150#, SCH.80, ASTM A105N, ASME B16.5', material_grade: 'ASTM A105N', specification: 'ASME B16.5', size: '6" #150', uom: 'PCS', unit_price_aed: 180.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-011', item_code: 'CPL253KNPTA105GB-STOCK', item_description: 'FULL COUPLING 1", 3000#, NPT, A105N, ASME B16.11', material_grade: 'ASTM A105N', specification: 'ASME B16.11', size: '1" 3000#', uom: 'PCS', unit_price_aed: 10.0, is_active: true, created_at: '2026-01-01' },
  { id: 'ITEM-012', item_code: 'WSW20150S40F316', item_description: '3/4" Flange SWRF CL150 Sch 40S SS316/SS316L', material_grade: 'SS316/316L', specification: 'ASTM A182 / ASME B16.5', size: '3/4" Sch 40', uom: 'PCS', unit_price_aed: 33.0, is_active: true, created_at: '2026-01-01' },
]

// Initial Stock Lots with Heat Numbers, YOM, Locations, and Purchase Types
const initialLots: StockLot[] = [
  { id: 'LOT-001', item_id: 'ITEM-001', item_code: 'WSO15150F316', item_description: '1/2" Flange SORF CL150 SS316/SS316L', heat_number: '889', yom: 2024, original_qty: 50, received_qty: 50, purchase_type: 'regular', supplier_name: 'WMASS GERMANY', stock_receipt_date: '2024-03-15', warehouse_location: 'LN-EB1', mtc_ref: 'MTC-WMASS-889.pdf', created_at: '2024-03-15', updated_at: '2026-10-15' },
  { id: 'LOT-002', item_id: 'ITEM-002', item_code: 'WSO20150F316', item_description: '3/4" Flange SORF CL150 SS316/SS316L', heat_number: 'A-2212', yom: 2025, original_qty: 50, received_qty: 50, purchase_type: 'regular', supplier_name: 'WMASS GERMANY', stock_receipt_date: '2025-01-20', warehouse_location: 'LN-EB1', mtc_ref: 'MTC-WMASS-A2212.pdf', created_at: '2025-01-20', updated_at: '2026-10-15' },
  { id: 'LOT-003', item_id: 'ITEM-002', item_code: 'WSO20150F316', item_description: '3/4" Flange SORF CL150 SS316/SS316L', heat_number: 'A-2211', yom: 2024, original_qty: 25, received_qty: 25, purchase_type: 'regular', supplier_name: 'WMASS GERMANY', stock_receipt_date: '2024-06-10', warehouse_location: 'LN-EC2', mtc_ref: 'MTC-WMASS-A2211.pdf', created_at: '2024-06-10', updated_at: '2026-10-15' },
  { id: 'LOT-004', item_id: 'ITEM-003', item_code: 'WSO40150F316', item_description: '1 1/2" Flange SORF CL150 SS316/SS316L', heat_number: 'A-2212', yom: 2025, original_qty: 50, received_qty: 50, purchase_type: 'regular', supplier_name: 'WMASS GERMANY', stock_receipt_date: '2025-02-14', warehouse_location: 'LN-EB1', mtc_ref: 'MTC-WMASS-A2212.pdf', created_at: '2025-02-14', updated_at: '2026-10-15' },
  { id: 'LOT-005', item_id: 'ITEM-004', item_code: 'WSO30150F316', item_description: '1 1/4" Flange SORF CL150 SS316/SS316L', heat_number: '980', yom: 2023, original_qty: 25, received_qty: 25, purchase_type: 'regular', supplier_name: 'WMASS GERMANY', stock_receipt_date: '2023-11-05', warehouse_location: 'LN-EB2', mtc_ref: 'MTC-WMASS-980.pdf', created_at: '2023-11-05', updated_at: '2026-10-15' },
  { id: 'LOT-006', item_id: 'ITEM-005', item_code: 'EL9050S80WPBBENKAN-STOCK', item_description: 'ELBOW 2", 90DEG, SCH.80, LR, BW, SMLS, ASTM A234 WPB', heat_number: '67C00M083', yom: 2024, original_qty: 210, received_qty: 210, purchase_type: 'regular', supplier_name: 'BENKAN THAILAND', stock_receipt_date: '2024-04-12', warehouse_location: 'LN-AC4', mtc_ref: 'MTC-BENKAN-67C00M083.pdf', created_at: '2024-04-12', updated_at: '2026-10-15' },
  { id: 'LOT-007', item_id: 'ITEM-006', item_code: 'EL9080S40WPBBENKAN-STOCK', item_description: 'ELBOW 3", 90DEG, SCH.40, LR, BW, SMLS, ASTM A234 WPB', heat_number: '65P00M036', yom: 2023, original_qty: 27, received_qty: 27, purchase_type: 'regular', supplier_name: 'BENKAN THAILAND', stock_receipt_date: '2023-08-20', warehouse_location: 'LN-AC4', mtc_ref: 'MTC-BENKAN-65P00M036.pdf', created_at: '2023-08-20', updated_at: '2026-10-15' },
  { id: 'LOT-008', item_id: 'ITEM-007', item_code: 'WSO80150F316-LOC', item_description: '3" Flange SORF CL150 SS316/SS316L (Item #8 - Local Purchase)', heat_number: 'LOC-A2212-LP', yom: 2026, original_qty: 10, received_qty: 10, purchase_type: 'local_purchase', supplier_name: 'SHREE OILFIELD SUPPLY LLC', l_code: 'L-WSO80150-08', stock_receipt_date: '2026-09-01', warehouse_location: 'LOCAL-BAY-01', mtc_ref: 'SUPPLIER_MTC_SHREE_LOC8.pdf', created_at: '2026-09-01', updated_at: '2026-10-15' },
  { id: 'LOT-009', item_id: 'ITEM-008', item_code: 'WSO100150F316-LOC', item_description: '4" Flange SORF CL150 SS316/SS316L (Item #9 - Local Purchase)', heat_number: 'LOC-A2211-LP', yom: 2026, original_qty: 10, received_qty: 10, purchase_type: 'local_purchase', supplier_name: 'PROMAT BD MIDDLE EAST', l_code: 'L-WSO100150-09', stock_receipt_date: '2026-09-15', warehouse_location: 'LOCAL-BAY-02', mtc_ref: 'SUPPLIER_MTC_PROMAT_LOC9.pdf', created_at: '2026-09-15', updated_at: '2026-10-15' },
  { id: 'LOT-010', item_id: 'ITEM-009', item_code: 'WN15150S80RFA105SRI-STOCK', item_description: 'FLANGE 1/2", 150#, SCH.80, WNRF, SA105N, ASME B16.5', heat_number: 'SRI2786', yom: 2024, original_qty: 141, received_qty: 141, purchase_type: 'regular', supplier_name: 'SRI FLANGES', stock_receipt_date: '2024-05-18', warehouse_location: 'LN-CB12', mtc_ref: 'MTC-SRI-2786.pdf', created_at: '2024-05-18', updated_at: '2026-10-15' },
  { id: 'LOT-011', item_id: 'ITEM-010', item_code: 'WN150150S80RFA105GB-STOCK', item_description: 'WNRF 6", 150#, SCH.80, ASTM A105N, ASME B16.5', heat_number: 'ULMA-8841', yom: 2025, original_qty: 20, received_qty: 20, purchase_type: 'regular', supplier_name: 'ULMA-SPAIN', stock_receipt_date: '2025-03-22', warehouse_location: 'LN-GB04', mtc_ref: 'MTC-ULMA-8841.pdf', created_at: '2025-03-22', updated_at: '2026-10-15' },
  { id: 'LOT-012', item_id: 'ITEM-011', item_code: 'CPL253KNPTA105GB-STOCK', item_description: 'FULL COUPLING 1", 3000#, NPT, A105N, ASME B16.11', heat_number: 'MG-9921B', yom: 2024, original_qty: 45, received_qty: 45, purchase_type: 'regular', supplier_name: 'MEGA-ITALY', stock_receipt_date: '2024-07-08', warehouse_location: 'LN-MB02', mtc_ref: 'MTC-MEGA-9921B.pdf', created_at: '2024-07-08', updated_at: '2026-10-15' },
]

// Initial Balances
const initialBalances: StockBalance[] = [
  { id: 'BAL-001', stock_lot_id: 'LOT-001', physical_qty: 40, reserved_qty: 5, available_qty: 35, dispatched_qty: 10, updated_at: '2026-10-15' },
  { id: 'BAL-002', stock_lot_id: 'LOT-002', physical_qty: 38, reserved_qty: 0, available_qty: 38, dispatched_qty: 12, updated_at: '2026-10-15' },
  { id: 'BAL-003', stock_lot_id: 'LOT-003', physical_qty: 25, reserved_qty: 0, available_qty: 25, dispatched_qty: 0, updated_at: '2026-10-15' },
  { id: 'BAL-004', stock_lot_id: 'LOT-004', physical_qty: 40, reserved_qty: 0, available_qty: 40, dispatched_qty: 10, updated_at: '2026-10-15' },
  { id: 'BAL-005', stock_lot_id: 'LOT-005', physical_qty: 20, reserved_qty: 0, available_qty: 20, dispatched_qty: 5, updated_at: '2026-10-15' },
  { id: 'BAL-006', stock_lot_id: 'LOT-006', physical_qty: 180, reserved_qty: 15, available_qty: 165, dispatched_qty: 30, updated_at: '2026-10-15' },
  { id: 'BAL-007', stock_lot_id: 'LOT-007', physical_qty: 7, reserved_qty: 0, available_qty: 7, dispatched_qty: 20, updated_at: '2026-10-15' },
  { id: 'BAL-008', stock_lot_id: 'LOT-008', physical_qty: 10, reserved_qty: 4, available_qty: 6, dispatched_qty: 0, updated_at: '2026-10-15' },
  { id: 'BAL-009', stock_lot_id: 'LOT-009', physical_qty: 10, reserved_qty: 0, available_qty: 10, dispatched_qty: 0, updated_at: '2026-10-15' },
  { id: 'BAL-010', stock_lot_id: 'LOT-010', physical_qty: 101, reserved_qty: 0, available_qty: 101, dispatched_qty: 40, updated_at: '2026-10-15' },
  { id: 'BAL-011', stock_lot_id: 'LOT-011', physical_qty: 14, reserved_qty: 0, available_qty: 14, dispatched_qty: 6, updated_at: '2026-10-15' },
  { id: 'BAL-012', stock_lot_id: 'LOT-012', physical_qty: 35, reserved_qty: 0, available_qty: 35, dispatched_qty: 10, updated_at: '2026-10-15' },
]

// Initial Local Purchase Records
const initialLocalPurchases: LocalPurchaseRecord[] = [
  {
    id: 'LP-001',
    l_code: 'L-WSO80150-08',
    item_id: 'ITEM-007',
    item_code: 'WSO80150F316-LOC',
    stock_lot_id: 'LOT-008',
    supplier_name: 'SHREE OILFIELD SUPPLY LLC',
    purchase_reference: 'PO-0326-3116 (Ref: MSG-0126-1752)',
    purchase_date: '2026-09-01',
    received_qty: 10,
    yom: 2026,
    supplier_mtc_uploaded: true,
    created_by: 'Inventory Manager',
    created_at: '2026-09-01',
  },
  {
    id: 'LP-002',
    l_code: 'L-WSO100150-09',
    item_id: 'ITEM-008',
    item_code: 'WSO100150F316-LOC',
    stock_lot_id: 'LOT-009',
    supplier_name: 'PROMAT BD MIDDLE EAST',
    purchase_reference: 'PO-0726-3549 (Ref: MSG-0126-1752/1730)',
    purchase_date: '2026-09-15',
    received_qty: 10,
    yom: 2026,
    supplier_mtc_uploaded: false,
    created_by: 'Inventory Manager',
    created_at: '2026-09-15',
  },
]

// Initial MTC Certificates
const initialMTCs: MTCCertificate[] = [
  { id: 'MTC-001', item_id: 'ITEM-001', item_code: 'WSO15150F316', stock_lot_id: 'LOT-001', heat_number: '889', yom: 2024, certificate_reference: 'WMASS-EN10204-889', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'WMASS GERMANY', upload_date: '2024-03-15', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2024-03-15' },
  { id: 'MTC-002', item_id: 'ITEM-002', item_code: 'WSO20150F316', stock_lot_id: 'LOT-002', heat_number: 'A-2212', yom: 2025, certificate_reference: 'WMASS-EN10204-A2212', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'WMASS GERMANY', upload_date: '2025-01-20', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2025-01-20' },
  { id: 'MTC-003', item_id: 'ITEM-002', item_code: 'WSO20150F316', stock_lot_id: 'LOT-003', heat_number: 'A-2211', yom: 2024, certificate_reference: 'WMASS-EN10204-A2211', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'WMASS GERMANY', upload_date: '2024-06-10', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 2, created_at: '2024-06-10' },
  { id: 'MTC-004', item_id: 'ITEM-003', item_code: 'WSO40150F316', stock_lot_id: 'LOT-004', heat_number: 'A-2212', yom: 2025, certificate_reference: 'WMASS-EN10204-A2212', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'WMASS GERMANY', upload_date: '2025-02-14', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2025-02-14' },
  { id: 'MTC-005', item_id: 'ITEM-004', item_code: 'WSO30150F316', stock_lot_id: 'LOT-005', heat_number: '980', yom: 2023, certificate_reference: 'WMASS-EN10204-980', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'WMASS GERMANY', upload_date: '2023-11-05', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 2, created_at: '2023-11-05' },
  { id: 'MTC-006', item_id: 'ITEM-005', item_code: 'EL9050S80WPBBENKAN-STOCK', stock_lot_id: 'LOT-006', heat_number: '67C00M083', yom: 2024, certificate_reference: 'BENKAN-3.1-67C00M083', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'BENKAN THAILAND', upload_date: '2024-04-12', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2024-04-12' },
  { id: 'MTC-007', item_id: 'ITEM-006', item_code: 'EL9080S40WPBBENKAN-STOCK', stock_lot_id: 'LOT-007', heat_number: '65P00M036', yom: 2023, certificate_reference: 'BENKAN-3.1-65P00M036', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'BENKAN THAILAND', upload_date: '2023-08-20', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 2, created_at: '2023-08-20' },
  { id: 'MTC-008', item_id: 'ITEM-007', item_code: 'WSO80150F316-LOC', stock_lot_id: 'LOT-008', heat_number: 'LOC-A2212-LP', l_code: 'L-WSO80150-08', yom: 2026, certificate_reference: 'SUPPLIER-SHREE-LOC8', original_file_path: '/sample-mtc.pdf', stamped_file_path: '/sample-mtc.pdf', purchase_type: 'local_purchase', supplier_name: 'SHREE OILFIELD SUPPLY LLC', upload_date: '2026-09-02', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2026-09-02' },
  { id: 'MTC-009', item_id: 'ITEM-009', item_code: 'WN15150S80RFA105SRI-STOCK', stock_lot_id: 'LOT-010', heat_number: 'SRI2786', yom: 2024, certificate_reference: 'SRI-3.1-2786', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'SRI FLANGES', upload_date: '2024-05-18', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 2, created_at: '2024-05-18' },
  { id: 'MTC-010', item_id: 'ITEM-010', item_code: 'WN150150S80RFA105GB-STOCK', stock_lot_id: 'LOT-011', heat_number: 'ULMA-8841', yom: 2025, certificate_reference: 'ULMA-EN10204-8841', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'ULMA-SPAIN', upload_date: '2025-03-22', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 3, created_at: '2025-03-22' },
  { id: 'MTC-011', item_id: 'ITEM-011', item_code: 'CPL253KNPTA105GB-STOCK', stock_lot_id: 'LOT-012', heat_number: 'MG-9921B', yom: 2024, certificate_reference: 'MEGA-3.1-9921B', original_file_path: '/sample-mtc.pdf', purchase_type: 'regular', supplier_name: 'MEGA-ITALY', upload_date: '2024-07-08', uploaded_by: 'MTC Controller', verification_status: 'Verified', approval_status: 'Approved', pages: 1, created_at: '2024-07-08' },
]

// Initial Sales Orders
const initialOrders: SalesOrder[] = [
  {
    id: 'ORD-115',
    so_number: 'SO-2026-115',
    po_number: 'PO-MCD-88412',
    customer_id: 'CUST-005',
    customer_name: 'McDermott Middle East Inc',
    order_date: '2026-10-15',
    required_delivery_date: '2026-10-30',
    status: 'Draft',
    created_by: 'Sales Representative',
    mtc_package_generated: false,
    created_at: '2026-10-15',
    updated_at: '2026-10-15',
    items: [
      { id: 'SOI-115-1', sales_order_id: 'ORD-115', item_id: 'ITEM-002', item_code: 'WSO20150F316', item_description: '3/4" Flange SORF CL150 SS316/SS316L', required_qty: 7, allocated_qty: 0, dispatched_qty: 0, uom: 'PCS', line_status: 'Pending' },
      { id: 'SOI-115-2', sales_order_id: 'ORD-115', item_id: 'ITEM-005', item_code: 'EL9050S80WPBBENKAN-STOCK', item_description: 'ELBOW 2", 90DEG, SCH.80, LR, BW, SMLS, ASTM A234 WPB', required_qty: 15, allocated_qty: 0, dispatched_qty: 0, uom: 'PCS', line_status: 'Pending' }
    ],
    allocations: []
  },
  {
    id: 'ORD-114',
    so_number: 'SO-2026-114',
    po_number: 'PO-PETROFAC-995',
    customer_id: 'CUST-002',
    customer_name: 'Petrofac Emirates LLC',
    order_date: '2026-10-14',
    required_delivery_date: '2026-10-25',
    status: 'Pending Storekeeper Approval',
    created_by: 'Sales Representative',
    mtc_package_generated: false,
    created_at: '2026-10-14',
    updated_at: '2026-10-14',
    items: [
      { id: 'SOI-114-1', sales_order_id: 'ORD-114', item_id: 'ITEM-001', item_code: 'WSO15150F316', item_description: '1/2" Flange SORF CL150 SS316/SS316L', required_qty: 5, allocated_qty: 5, dispatched_qty: 0, uom: 'PCS', line_status: 'Allocated' },
      { id: 'SOI-114-2', sales_order_id: 'ORD-114', item_id: 'ITEM-007', item_code: 'WSO80150F316-LOC', item_description: '3" Flange SORF CL150 SS316/SS316L (Item #8 - Local Purchase)', required_qty: 4, allocated_qty: 4, dispatched_qty: 0, uom: 'PCS', line_status: 'Allocated' }
    ],
    allocations: [
      { id: 'ALC-114-1', sales_order_item_id: 'SOI-114-1', sales_order_id: 'ORD-114', stock_lot_id: 'LOT-001', heat_number: '889', allocated_qty: 5, released_qty: 0, dispatched_qty: 0, allocation_status: 'Allocated', created_at: '2026-10-14', updated_at: '2026-10-14' },
      { id: 'ALC-114-2', sales_order_item_id: 'SOI-114-2', sales_order_id: 'ORD-114', stock_lot_id: 'LOT-008', heat_number: 'LOC-A2212-LP', allocated_qty: 4, released_qty: 0, dispatched_qty: 0, allocation_status: 'Allocated', created_at: '2026-10-14', updated_at: '2026-10-14' }
    ]
  },
  {
    id: 'ORD-113',
    so_number: 'SO-2026-113',
    po_number: 'PO-ADNOC-5502',
    customer_id: 'CUST-001',
    customer_name: 'ADNOC Refining & Petrochemicals',
    order_date: '2026-10-12',
    required_delivery_date: '2026-10-22',
    status: 'Approved',
    created_by: 'Sales Representative',
    approved_by: 'Tariq Al-Hashimi (Head Storekeeper)',
    store_remarks: 'Physical heat markings and tag LN-EB1 verified at Yard-1. Ready for MTC packaging & dispatch.',
    mtc_package_generated: true,
    mtc_package_url: '/sample-mtc.pdf',
    created_at: '2026-10-12',
    updated_at: '2026-10-13',
    items: [
      { id: 'SOI-113-1', sales_order_id: 'ORD-113', item_id: 'ITEM-002', item_code: 'WSO20150F316', item_description: '3/4" Flange SORF CL150 SS316/SS316L', required_qty: 10, allocated_qty: 10, dispatched_qty: 0, uom: 'PCS', line_status: 'Approved' }
    ],
    allocations: [
      { id: 'ALC-113-1', sales_order_item_id: 'SOI-113-1', sales_order_id: 'ORD-113', stock_lot_id: 'LOT-002', heat_number: 'A-2212', allocated_qty: 10, released_qty: 0, dispatched_qty: 0, allocation_status: 'Allocated', created_at: '2026-10-12', updated_at: '2026-10-13' }
    ]
  },
  {
    id: 'ORD-101',
    so_number: 'SO-2026-101',
    po_number: 'PO-ADNOC-4410',
    customer_id: 'CUST-001',
    customer_name: 'ADNOC Refining & Petrochemicals',
    order_date: '2026-08-10',
    required_delivery_date: '2026-08-15',
    status: 'Dispatched',
    created_by: 'Sales Representative',
    approved_by: 'Tariq Al-Hashimi',
    mtc_package_generated: true,
    mtc_package_url: '/sample-mtc.pdf',
    created_at: '2026-08-10',
    updated_at: '2026-08-12',
    items: [
      { id: 'SOI-101-1', sales_order_id: 'ORD-101', item_id: 'ITEM-001', item_code: 'WSO15150F316', item_description: '1/2" Flange SORF CL150 SS316/SS316L', required_qty: 10, allocated_qty: 10, dispatched_qty: 10, uom: 'PCS', line_status: 'Dispatched' }
    ],
    allocations: [
      { id: 'ALC-101-1', sales_order_item_id: 'SOI-101-1', sales_order_id: 'ORD-101', stock_lot_id: 'LOT-001', heat_number: '889', allocated_qty: 10, released_qty: 0, dispatched_qty: 10, allocation_status: 'Dispatched', created_at: '2026-08-10', updated_at: '2026-08-12' }
    ]
  },
  {
    id: 'ORD-098',
    so_number: 'SO-2026-098',
    po_number: 'PO-ENOC-7712',
    customer_id: 'CUST-003',
    customer_name: 'Emirates Global Aluminium (DUBAL)',
    order_date: '2026-07-15',
    required_delivery_date: '2026-07-25',
    status: 'Cancelled',
    created_by: 'Sales Representative',
    cancellation_date: '2026-07-20',
    cancellation_reason: 'Client project cancelled by engineering team. Reserved stock released back to available inventory.',
    mtc_package_generated: false,
    created_at: '2026-07-15',
    updated_at: '2026-07-20',
    items: [
      { id: 'SOI-098-1', sales_order_id: 'ORD-098', item_id: 'ITEM-001', item_code: 'WSO15150F316', item_description: '1/2" Flange SORF CL150 SS316/SS316L', required_qty: 8, allocated_qty: 8, dispatched_qty: 0, uom: 'PCS', line_status: 'Cancelled' }
    ],
    allocations: [
      { id: 'ALC-098-1', sales_order_item_id: 'SOI-098-1', sales_order_id: 'ORD-098', stock_lot_id: 'LOT-001', heat_number: '889', allocated_qty: 8, released_qty: 8, dispatched_qty: 0, allocation_status: 'Released', created_at: '2026-07-15', updated_at: '2026-07-20' }
    ]
  }
]

// Initial Movements
const initialMovements: StockMovement[] = [
  { id: 'MOV-001', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Opening Stock', quantity: 50, reference_type: 'Receipt', reference_id: 'GRN-2024-0315', previous_balance: 0, new_balance: 50, performed_by: 'System Init', timestamp: '2024-03-15 09:00', remarks: 'Received from WMASS Germany' },
  { id: 'MOV-002', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Reservation', quantity: 10, reference_type: 'SalesOrder', reference_id: 'SO-2026-101', previous_balance: 50, new_balance: 40, performed_by: 'Sales Team', timestamp: '2026-08-10 11:20', remarks: 'Allocated for SO-2026-101' },
  { id: 'MOV-003', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Dispatch', quantity: 10, reference_type: 'DeliveryNote', reference_id: 'DN-2026-0812', previous_balance: 50, new_balance: 40, performed_by: 'Dispatch Team', timestamp: '2026-08-12 14:00', remarks: 'Delivered to ADNOC Refining' },
  { id: 'MOV-004', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Reservation', quantity: 8, reference_type: 'SalesOrder', reference_id: 'SO-2026-098', previous_balance: 40, new_balance: 32, performed_by: 'Sales Team', timestamp: '2026-07-15 10:15', remarks: 'Allocated for SO-2026-098' },
  { id: 'MOV-005', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Reservation Release', quantity: 8, reference_type: 'SalesOrderCancellation', reference_id: 'SO-2026-098', previous_balance: 32, new_balance: 40, performed_by: 'Sales Team', timestamp: '2026-07-20 16:45', remarks: 'Client cancelled order - Stock fully reversed to available balance' },
  { id: 'MOV-006', stock_lot_id: 'LOT-001', item_code: 'WSO15150F316', heat_number: '889', movement_type: 'Reservation', quantity: 5, reference_type: 'SalesOrder', reference_id: 'SO-2026-114', previous_balance: 40, new_balance: 35, performed_by: 'Sales Team', timestamp: '2026-10-14 09:30', remarks: 'Allocated for SO-2026-114' },
  { id: 'MOV-007', stock_lot_id: 'LOT-008', item_code: 'WSO80150F316-LOC', heat_number: 'LOC-A2212-LP', movement_type: 'Stock Receipt', quantity: 10, reference_type: 'LocalPurchase', reference_id: 'L-WSO80150-08', previous_balance: 0, new_balance: 10, performed_by: 'Inventory Manager', timestamp: '2026-09-01 10:00', remarks: 'Local purchase from Shree Oilfield' },
  { id: 'MOV-008', stock_lot_id: 'LOT-008', item_code: 'WSO80150F316-LOC', heat_number: 'LOC-A2212-LP', movement_type: 'Reservation', quantity: 4, reference_type: 'SalesOrder', reference_id: 'SO-2026-114', previous_balance: 10, new_balance: 6, performed_by: 'Sales Team', timestamp: '2026-10-14 09:30', remarks: 'Allocated for SO-2026-114' },
]

// Initial Users with all 7 roles
export const initialUsers: UserProfile[] = [
  { id: 'USR-001', employee_name: 'Zaid Al-Mansoor', email: 'admin@msgoilfield.ae', department: 'Executive Management', role: 'super_admin', account_status: 'Active', created_at: '2026-01-01', last_login: '2026-10-29 08:00' },
  { id: 'USR-002', employee_name: 'Vikram Sharma', email: 'inventory@msgoilfield.ae', department: 'Inventory & Procurement', role: 'admin_inventory', account_status: 'Active', created_at: '2026-01-05', last_login: '2026-10-29 07:45' },
  { id: 'USR-003', employee_name: 'Fahad Bin Rashid', email: 'sales@msgoilfield.ae', department: 'Commercial Sales', role: 'sales_team', account_status: 'Active', created_at: '2026-01-10', last_login: '2026-10-28 17:30' },
  { id: 'USR-004', employee_name: 'Tariq Al-Hashimi', email: 'storekeeper@msgoilfield.ae', department: 'Warehouse & Yard-1', role: 'storekeeper', account_status: 'Active', created_at: '2026-01-12', last_login: '2026-10-29 07:15' },
  { id: 'USR-005', employee_name: 'Maryam Al-Nuaimi', email: 'mtc@msgoilfield.ae', department: 'Quality Assurance & QA/QC', role: 'mtc_controller', account_status: 'Active', created_at: '2026-01-15', last_login: '2026-10-28 16:00' },
  { id: 'USR-006', employee_name: 'Ramesh Patel', email: 'dispatch@msgoilfield.ae', department: 'Logistics & Dispatch', role: 'dispatch_team', account_status: 'Active', created_at: '2026-02-01', last_login: '2026-10-28 15:40' },
  { id: 'USR-007', employee_name: 'Arthur Sterling', email: 'viewer@msgoilfield.ae', department: 'Board of Directors / Audit', role: 'management_viewer', account_status: 'Active', created_at: '2026-02-10', last_login: '2026-10-27 11:20' },
]

// Database singleton and state provider
class DBService {
  private customers: Customer[] = []
  private items: Item[] = []
  private lots: StockLot[] = []
  private balances: StockBalance[] = []
  private orders: SalesOrder[] = []
  private mtcs: MTCCertificate[] = []
  private localPurchases: LocalPurchaseRecord[] = []
  private movements: StockMovement[] = []
  private approvals: ApprovalRecord[] = []
  private dispatches: DispatchRecord[] = []
  private returns: StockReturn[] = []
  private adjustments: StockAdjustment[] = []
  private audits: AuditLog[] = []
  private importJobs: ExcelImportJob[] = []
  private users: UserProfile[] = []

  private listeners: (() => void)[] = []

  constructor() {
    this.init()
  }

  private init() {
    this.customers = loadFromStorage('customers', initialCustomers)
    this.items = loadFromStorage('items', initialItems)
    this.lots = loadFromStorage('lots', initialLots)
    this.balances = loadFromStorage('balances', initialBalances)
    this.orders = loadFromStorage('orders', initialOrders)
    this.mtcs = loadFromStorage('mtcs', initialMTCs)
    this.localPurchases = loadFromStorage('localPurchases', initialLocalPurchases)
    this.movements = loadFromStorage('movements', initialMovements)
    this.approvals = loadFromStorage('approvals', [])
    this.dispatches = loadFromStorage('dispatches', [])
    this.returns = loadFromStorage('returns', [])
    this.adjustments = loadFromStorage('adjustments', [])
    this.audits = loadFromStorage('audits', [])
    this.importJobs = loadFromStorage('importJobs', [])
    this.users = loadFromStorage('users', initialUsers)
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach(l => l())
  }

  // Getters
  public getCustomers() { return [...this.customers] }
  public getItems() { return [...this.items] }
  public getLots() { return [...this.lots] }
  public getBalances() { return [...this.balances] }
  public getOrders() { return [...this.orders] }
  public getMTCs() { return [...this.mtcs] }
  public getLocalPurchases() { return [...this.localPurchases] }
  public getMovements() { return [...this.movements] }
  public getApprovals() { return [...this.approvals] }
  public getDispatches() { return [...this.dispatches] }
  public getReturns() { return [...this.returns] }
  public getAdjustments() { return [...this.adjustments] }
  public getAudits() { return [...this.audits] }
  public getImportJobs() { return [...this.importJobs] }
  public getUsers() { return [...this.users] }

  // Combined Master Stock View
  public getMasterStockView() {
    return this.lots.map(lot => {
      const bal = this.balances.find(b => b.stock_lot_id === lot.id) || {
        physical_qty: 0,
        reserved_qty: 0,
        available_qty: 0,
        dispatched_qty: 0
      }
      const item = this.items.find(i => i.id === lot.item_id)
      const mtc = this.mtcs.find(m => m.stock_lot_id === lot.id)

      return {
        ...lot,
        material_grade: item?.material_grade || '',
        specification: item?.specification || '',
        size: item?.size || '',
        uom: item?.uom || 'PCS',
        unit_price_aed: item?.unit_price_aed || 0,
        physical_qty: bal.physical_qty,
        reserved_qty: bal.reserved_qty,
        available_qty: bal.available_qty,
        dispatched_qty: bal.dispatched_qty,
        mtc_status: mtc ? (mtc.stamped_file_path ? 'Stamped & Verified' : mtc.verification_status) : 'Missing MTC',
        mtc_pages: mtc?.pages || 0,
        mtc_id: mtc?.id
      }
    })
  }

  // FIFO Allocation Engine
  public allocateFIFO(orderId: string, itemId: string, requiredQty: number, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    const item = this.items.find(i => i.id === itemId)
    if (!item) return { success: false, message: 'Item not found' }

    // Find available lots for this item
    const matchingLots = this.lots
      .filter(l => l.item_id === itemId)
      .map(lot => {
        const bal = this.balances.find(b => b.stock_lot_id === lot.id)
        return { lot, balance: bal }
      })
      .filter(x => x.balance && x.balance.available_qty > 0)

    // Sort FIFO: stock_receipt_date ASC, then yom ASC, then id ASC
    matchingLots.sort((a, b) => {
      if (a.lot.stock_receipt_date !== b.lot.stock_receipt_date) {
        return a.lot.stock_receipt_date.localeCompare(b.lot.stock_receipt_date)
      }
      return (a.lot.yom || 2024) - (b.lot.yom || 2024)
    })

    const totalAvailable = matchingLots.reduce((sum, x) => sum + (x.balance?.available_qty || 0), 0)
    if (totalAvailable < requiredQty) {
      return {
        success: false,
        message: `Insufficient stock for ${item.item_code}. Required: ${requiredQty} PCS, Total Available: ${totalAvailable} PCS.`
      }
    }

    let remaining = requiredQty
    const allocatedLots: { heat_number: string; qty: number; yom: number; lot_id: string }[] = []

    for (const match of matchingLots) {
      if (remaining <= 0) break
      const take = Math.min(remaining, match.balance!.available_qty)

      // Update balance
      match.balance!.reserved_qty += take
      match.balance!.available_qty -= take
      match.balance!.updated_at = new Date().toISOString()

      // Record Allocation
      const allocId = 'ALC-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
      order.allocations.push({
        id: allocId,
        sales_order_item_id: order.items.find(i => i.item_id === itemId)?.id || '',
        sales_order_id: order.id,
        stock_lot_id: match.lot.id,
        heat_number: match.lot.heat_number,
        allocated_qty: take,
        released_qty: 0,
        dispatched_qty: 0,
        allocation_status: 'Allocated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

      // Record Movement
      this.movements.unshift({
        id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
        stock_lot_id: match.lot.id,
        item_code: item.item_code,
        heat_number: match.lot.heat_number,
        movement_type: 'Reservation',
        quantity: take,
        reference_type: 'SalesOrder',
        reference_id: order.so_number,
        previous_balance: match.balance!.available_qty + take,
        new_balance: match.balance!.available_qty,
        performed_by: userEmail,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        remarks: `FIFO Reservation for ${order.so_number} (${take} PCS)`
      })

      allocatedLots.push({
        heat_number: match.lot.heat_number,
        qty: take,
        yom: match.lot.yom,
        lot_id: match.lot.id
      })

      remaining -= take
    }

    // Update sales order item allocated quantity
    const orderItem = order.items.find(i => i.item_id === itemId)
    if (orderItem) {
      orderItem.allocated_qty += requiredQty
      orderItem.line_status = 'Allocated'
    }

    // Update order status if all items allocated
    const allAllocated = order.items.every(i => i.allocated_qty >= i.required_qty)
    if (allAllocated) {
      order.status = 'Stock Allocated'
    }

    this.saveAll()
    this.logAudit(userEmail, 'FIFO Stock Allocation', 'Sales Orders', order.so_number, null, { allocatedLots })
    this.notify()

    return {
      success: true,
      allocated: allocatedLots,
      message: `Successfully allocated ${requiredQty} PCS across ${allocatedLots.length} heat(s).`
    }
  }

  // Manual Heat Number Selection
  public allocateManual(orderId: string, itemId: string, stockLotId: string, requiredQty: number, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    const item = this.items.find(i => i.id === itemId)
    if (!item) return { success: false, message: 'Item not found' }

    const lot = this.lots.find(l => l.id === stockLotId)
    if (!lot) return { success: false, message: 'Stock lot not found' }

    const bal = this.balances.find(b => b.stock_lot_id === stockLotId)
    if (!bal || bal.available_qty < requiredQty) {
      return {
        success: false,
        message: `Insufficient stock in Heat ${lot.heat_number}. Required: ${requiredQty} PCS, Available: ${bal?.available_qty || 0} PCS.`
      }
    }

    // Deduct available, add to reserved
    bal.reserved_qty += requiredQty
    bal.available_qty -= requiredQty
    bal.updated_at = new Date().toISOString()

    const allocId = 'ALC-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
    order.allocations.push({
      id: allocId,
      sales_order_item_id: order.items.find(i => i.item_id === itemId)?.id || '',
      sales_order_id: order.id,
      stock_lot_id: lot.id,
      heat_number: lot.heat_number,
      allocated_qty: requiredQty,
      released_qty: 0,
      dispatched_qty: 0,
      allocation_status: 'Allocated',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    // Record Movement
    this.movements.unshift({
      id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      stock_lot_id: lot.id,
      item_code: item.item_code,
      heat_number: lot.heat_number,
      movement_type: 'Reservation',
      quantity: requiredQty,
      reference_type: 'SalesOrder',
      reference_id: order.so_number,
      previous_balance: bal.available_qty + requiredQty,
      new_balance: bal.available_qty,
      performed_by: userEmail,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      remarks: `Manual Heat Selection: ${lot.heat_number} reserved for ${order.so_number} (${requiredQty} PCS)`
    })

    const orderItem = order.items.find(i => i.item_id === itemId)
    if (orderItem) {
      orderItem.allocated_qty += requiredQty
      orderItem.line_status = 'Allocated'
    }

    const allAllocated = order.items.every(i => i.allocated_qty >= i.required_qty)
    if (allAllocated) {
      order.status = 'Stock Allocated'
    }

    this.saveAll()
    this.logAudit(userEmail, 'Manual Heat Allocation', 'Sales Orders', order.so_number, null, { heat: lot.heat_number, qty: requiredQty })
    this.notify()

    return {
      success: true,
      message: `Successfully allocated ${requiredQty} PCS from Heat ${lot.heat_number}.`
    }
  }

  // Submit Order for Storekeeper Physical Approval
  public submitForApproval(orderId: string, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }
    if (order.status !== 'Stock Allocated') {
      return { success: false, message: 'Stock must be allocated before submitting for storekeeper approval.' }
    }

    order.status = 'Pending Storekeeper Approval'
    order.updated_at = new Date().toISOString()

    this.saveAll()
    this.logAudit(userEmail, 'Submitted for Approval', 'Sales Orders', order.so_number)
    this.notify()
    return { success: true, message: 'Sales Order submitted to Storekeeper approval queue.' }
  }

  // Storekeeper Approval Action
  public storekeeperApprove(orderId: string, approverName: string, status: 'Approved' | 'Rejected' | 'Correction Requested', remarks: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    if (status === 'Approved') {
      order.status = 'Approved'
      order.approved_by = approverName
      order.store_remarks = remarks
    } else if (status === 'Rejected') {
      order.status = 'Draft'
      order.store_remarks = `Rejected: ${remarks}`
    } else {
      order.status = 'Draft'
      order.store_remarks = `Correction requested: ${remarks}`
    }

    order.updated_at = new Date().toISOString()

    // Record Approval
    this.approvals.unshift({
      id: 'APR-' + Date.now(),
      sales_order_id: order.id,
      so_number: order.so_number,
      approval_type: 'Storekeeper Physical Verification',
      approval_status: status,
      approved_by: approverName,
      approval_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      remarks: remarks
    })

    this.saveAll()
    this.logAudit(approverName, `Storekeeper ${status}`, 'Approvals', order.so_number, null, { remarks })
    this.notify()
    return { success: true, message: `Storekeeper status recorded: ${status}` }
  }

  // Cancel Sales Order with Comprehensive Reservation Release Safeguards
  public cancelSalesOrder(orderId: string, reason: string, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    if (order.status === 'Cancelled') {
      return { success: false, message: 'Order is already cancelled' }
    }

    // Safety check: Fully Dispatched orders cannot be cancelled to restore stock without formal return
    if (order.status === 'Dispatched') {
      return {
        success: false,
        message: 'Order is fully dispatched. Dispatched materials cannot be restored by cancellation. Please create an authorized Return.'
      }
    }

    // Release only undispatched reservations
    for (const alloc of order.allocations) {
      if (alloc.allocation_status === 'Allocated') {
        const bal = this.balances.find(b => b.stock_lot_id === alloc.stock_lot_id)
        const unreleased = alloc.allocated_qty - alloc.dispatched_qty

        if (bal && unreleased > 0) {
          bal.reserved_qty -= unreleased
          bal.available_qty += unreleased
          bal.updated_at = new Date().toISOString()

          alloc.released_qty = unreleased
          alloc.allocation_status = 'Released'
          alloc.updated_at = new Date().toISOString()

          // Log movement
          this.movements.unshift({
            id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
            stock_lot_id: alloc.stock_lot_id,
            item_code: order.items.find(i => i.id === alloc.sales_order_item_id)?.item_code || '',
            heat_number: alloc.heat_number,
            movement_type: 'Reservation Release',
            quantity: unreleased,
            reference_type: 'SalesOrderCancellation',
            reference_id: order.so_number,
            previous_balance: bal.available_qty - unreleased,
            new_balance: bal.available_qty,
            performed_by: userEmail,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            remarks: `Order Cancelled: ${reason}. ${unreleased} PCS restored to available stock.`
          })
        }
      }
    }

    order.status = 'Cancelled'
    order.cancellation_date = new Date().toISOString().replace('T', ' ').substring(0, 16)
    order.cancellation_reason = reason
    order.updated_at = new Date().toISOString()

    this.saveAll()
    this.logAudit(userEmail, 'Cancel Sales Order', 'Sales Orders', order.so_number, null, { reason })
    this.notify()

    return {
      success: true,
      message: `Sales Order ${order.so_number} cancelled. Outstanding reservations released back to available stock.`
    }
  }

  // Confirm Dispatch
  public confirmDispatch(
    orderId: string,
    dispatchItems: { allocation_id: string; dispatch_qty: number }[],
    deliveryNote: string,
    deliveryRef: string,
    userEmail: string,
    remarks: string
  ) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    if (order.status !== 'Approved' && order.status !== 'MTC Generated' && order.status !== 'Partially Dispatched') {
      return { success: false, message: 'Only storekeeper-approved orders can be dispatched.' }
    }

    const itemsSummary: { item_code: string; heat_number: string; quantity: number }[] = []

    for (const item of dispatchItems) {
      const alloc = order.allocations.find(a => a.id === item.allocation_id)
      if (!alloc) continue

      const remainingAlloc = alloc.allocated_qty - alloc.dispatched_qty
      if (item.dispatch_qty > remainingAlloc) {
        return {
          success: false,
          message: `Dispatch quantity (${item.dispatch_qty}) exceeds approved allocation balance (${remainingAlloc}) for Heat ${alloc.heat_number}.`
        }
      }

      const bal = this.balances.find(b => b.stock_lot_id === alloc.stock_lot_id)
      if (bal) {
        // Physical stock reduces by dispatched qty
        // Reserved stock reduces by dispatched qty
        // Available stock remains unchanged (already subtracted during reservation)
        bal.physical_qty -= item.dispatch_qty
        bal.reserved_qty -= item.dispatch_qty
        bal.dispatched_qty += item.dispatch_qty
        bal.updated_at = new Date().toISOString()

        alloc.dispatched_qty += item.dispatch_qty
        if (alloc.dispatched_qty >= alloc.allocated_qty) {
          alloc.allocation_status = 'Dispatched'
        }

        const soItem = order.items.find(i => i.id === alloc.sales_order_item_id)
        if (soItem) {
          soItem.dispatched_qty += item.dispatch_qty
          if (soItem.dispatched_qty >= soItem.required_qty) {
            soItem.line_status = 'Dispatched'
          }
        }

        itemsSummary.push({
          item_code: soItem?.item_code || '',
          heat_number: alloc.heat_number,
          quantity: item.dispatch_qty
        })

        // Immutable stock movement
        this.movements.unshift({
          id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
          stock_lot_id: alloc.stock_lot_id,
          item_code: soItem?.item_code || '',
          heat_number: alloc.heat_number,
          movement_type: 'Dispatch',
          quantity: item.dispatch_qty,
          reference_type: 'DeliveryNote',
          reference_id: deliveryNote,
          previous_balance: bal.physical_qty + item.dispatch_qty,
          new_balance: bal.physical_qty,
          performed_by: userEmail,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          remarks: `Dispatched ${item.dispatch_qty} PCS against ${order.so_number} (DN: ${deliveryNote})`
        })
      }
    }

    // Determine overall order status
    const allDispatched = order.items.every(i => i.dispatched_qty >= i.required_qty)
    order.status = allDispatched ? 'Dispatched' : 'Partially Dispatched'
    order.updated_at = new Date().toISOString()

    // Record Dispatch
    const dispId = 'DSP-' + Date.now()
    this.dispatches.unshift({
      id: dispId,
      sales_order_id: order.id,
      so_number: order.so_number,
      dispatch_reference: deliveryRef || `DSP-${Date.now().toString().slice(-4)}`,
      dispatch_date: new Date().toISOString().substring(0, 10),
      delivery_note_number: deliveryNote,
      customer_name: order.customer_name,
      dispatched_by: userEmail,
      delivery_remarks: remarks,
      items_summary: itemsSummary,
      created_at: new Date().toISOString()
    })

    this.saveAll()
    this.logAudit(userEmail, 'Dispatch Confirmed', 'Dispatch', order.so_number, null, { deliveryNote, itemsSummary })
    this.notify()

    return {
      success: true,
      message: `Dispatch confirmed for ${order.so_number}. Delivery Note: ${deliveryNote}`
    }
  }

  // Material Return
  public recordMaterialReturn(orderId: string, stockLotId: string, qty: number, reason: string, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    const lot = this.lots.find(l => l.id === stockLotId)
    const bal = this.balances.find(b => b.stock_lot_id === stockLotId)

    if (!lot || !bal) return { success: false, message: 'Stock lot not found' }

    // Physical stock increases, available stock increases
    bal.physical_qty += qty
    bal.available_qty += qty
    bal.dispatched_qty = Math.max(0, bal.dispatched_qty - qty)
    bal.updated_at = new Date().toISOString()

    const retId = 'RET-' + Date.now()
    this.returns.unshift({
      id: retId,
      sales_order_id: orderId,
      so_number: order?.so_number || 'N/A',
      stock_lot_id: stockLotId,
      item_code: lot.item_code,
      heat_number: lot.heat_number,
      returned_qty: qty,
      return_date: new Date().toISOString().substring(0, 10),
      reason,
      authorized_by: userEmail,
      acceptance_status: 'Accepted',
      created_at: new Date().toISOString()
    })

    this.movements.unshift({
      id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      stock_lot_id: stockLotId,
      item_code: lot.item_code,
      heat_number: lot.heat_number,
      movement_type: 'Approved Customer Return',
      quantity: qty,
      reference_type: 'CustomerReturn',
      reference_id: retId,
      previous_balance: bal.physical_qty - qty,
      new_balance: bal.physical_qty,
      performed_by: userEmail,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      remarks: `Material Return: ${qty} PCS accepted back into inventory. Reason: ${reason}`
    })

    this.saveAll()
    this.logAudit(userEmail, 'Material Return Accepted', 'Returns', lot.heat_number, null, { qty, reason })
    this.notify()

    return { success: true, message: `Material Return recorded. ${qty} PCS restored to physical and available inventory.` }
  }

  // Stock Adjustment (Manager Authorized)
  public adjustStock(stockLotId: string, newPhysicalQty: number, reason: string, userEmail: string) {
    const lot = this.lots.find(l => l.id === stockLotId)
    const bal = this.balances.find(b => b.stock_lot_id === stockLotId)

    if (!lot || !bal) return { success: false, message: 'Stock lot not found' }

    const oldPhysical = bal.physical_qty
    const diff = newPhysicalQty - oldPhysical

    if (newPhysicalQty < bal.reserved_qty) {
      return {
        success: false,
        message: `New physical quantity (${newPhysicalQty}) cannot be less than currently reserved quantity (${bal.reserved_qty}).`
      }
    }

    bal.physical_qty = newPhysicalQty
    bal.available_qty = newPhysicalQty - bal.reserved_qty
    bal.updated_at = new Date().toISOString()

    const adjId = 'ADJ-' + Date.now()
    this.adjustments.unshift({
      id: adjId,
      stock_lot_id: stockLotId,
      item_code: lot.item_code,
      heat_number: lot.heat_number,
      original_balance: oldPhysical,
      adjusted_balance: newPhysicalQty,
      difference_qty: diff,
      reason,
      requested_by: userEmail,
      approved_by: userEmail,
      status: 'Approved',
      created_at: new Date().toISOString()
    })

    this.movements.unshift({
      id: 'MOV-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      stock_lot_id: stockLotId,
      item_code: lot.item_code,
      heat_number: lot.heat_number,
      movement_type: 'Stock Adjustment',
      quantity: diff,
      reference_type: 'Adjustment',
      reference_id: adjId,
      previous_balance: oldPhysical,
      new_balance: newPhysicalQty,
      performed_by: userEmail,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      remarks: `Stock Adjustment: ${diff > 0 ? '+' : ''}${diff} PCS. Reason: ${reason}`
    })

    this.saveAll()
    this.logAudit(userEmail, 'Stock Adjustment', 'Inventory', lot.heat_number, { oldPhysical }, { newPhysicalQty, reason })
    this.notify()

    return { success: true, message: `Stock adjusted for Heat ${lot.heat_number} from ${oldPhysical} to ${newPhysicalQty} PCS.` }
  }

  // Create Sales Order
  public createSalesOrder(orderData: {
    customer_id: string
    po_number: string
    required_delivery_date: string
    items: { item_id: string; required_qty: number }[]
    userEmail: string
  }) {
    const customer = this.customers.find(c => c.id === orderData.customer_id)
    if (!customer) return { success: false, message: 'Customer not found' }

    const count = this.orders.length + 116
    const soNumber = `SO-2026-${count}`
    const orderId = `ORD-${count}`

    const soItems = orderData.items.map((item, idx) => {
      const itm = this.items.find(i => i.id === item.item_id)
      return {
        id: `SOI-${count}-${idx + 1}`,
        sales_order_id: orderId,
        item_id: item.item_id,
        item_code: itm?.item_code || '',
        item_description: itm?.item_description || '',
        required_qty: item.required_qty,
        allocated_qty: 0,
        dispatched_qty: 0,
        uom: itm?.uom || 'PCS',
        line_status: 'Pending' as const
      }
    })

    const newOrder: SalesOrder = {
      id: orderId,
      so_number: soNumber,
      po_number: orderData.po_number || 'PO-PENDING',
      customer_id: customer.id,
      customer_name: customer.customer_name,
      order_date: new Date().toISOString().substring(0, 10),
      required_delivery_date: orderData.required_delivery_date || '',
      status: 'Draft',
      created_by: orderData.userEmail,
      mtc_package_generated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: soItems,
      allocations: []
    }

    this.orders.unshift(newOrder)
    this.saveAll()
    this.logAudit(orderData.userEmail, 'Create Sales Order', 'Sales Orders', soNumber, null, newOrder)
    this.notify()

    return { success: true, order: newOrder, message: `Sales Order ${soNumber} created successfully.` }
  }

  // Add Item to Item Master
  public addItem(item: Omit<Item, 'id' | 'created_at'>, userEmail: string) {
    if (this.items.some(i => i.item_code.toLowerCase() === item.item_code.toLowerCase())) {
      return { success: false, message: `Item code ${item.item_code} already exists.` }
    }

    const newItem: Item = {
      ...item,
      id: 'ITEM-' + (this.items.length + 1).toString().padStart(3, '0'),
      created_at: new Date().toISOString()
    }

    this.items.push(newItem)
    this.saveAll()
    this.logAudit(userEmail, 'Add Item', 'Item Master', newItem.item_code, null, newItem)
    this.notify()
    return { success: true, item: newItem }
  }

  // Add Stock Lot
  public addStockLot(lotData: {
    item_id: string
    heat_number: string
    yom: number
    quantity: number
    purchase_type: 'regular' | 'local_purchase'
    supplier_name: string
    warehouse_location: string
    l_code?: string
    mtc_ref?: string
    userEmail: string
  }) {
    const item = this.items.find(i => i.id === lotData.item_id)
    if (!item) return { success: false, message: 'Item not found' }

    const lotId = 'LOT-' + (this.lots.length + 1).toString().padStart(3, '0')
    const newLot: StockLot = {
      id: lotId,
      item_id: item.id,
      item_code: item.item_code,
      item_description: item.item_description,
      heat_number: lotData.heat_number,
      yom: lotData.yom || 2026,
      original_qty: lotData.quantity,
      received_qty: lotData.quantity,
      purchase_type: lotData.purchase_type,
      supplier_name: lotData.supplier_name,
      l_code: lotData.l_code || (lotData.purchase_type === 'local_purchase' ? `L-${item.item_code.slice(0, 8)}-${this.lots.length + 1}` : undefined),
      stock_receipt_date: new Date().toISOString().substring(0, 10),
      warehouse_location: lotData.warehouse_location || 'YARD-1',
      mtc_ref: lotData.mtc_ref,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (lotData.mtc_ref || lotData.heat_number) {
      const heatUpper = lotData.heat_number.toUpperCase().trim()
      const refClean = (lotData.mtc_ref || '').trim()

      const matchedMtc = this.mtcs.find(m => 
        (refClean && (m.certificate_reference === refClean || m.original_file_path.includes(refClean))) || 
        (heatUpper && !heatUpper.startsWith('LOT-') && m.heat_number.toUpperCase() === heatUpper)
      )

      if (matchedMtc) {
        matchedMtc.stock_lot_id = lotId
        matchedMtc.item_id = item.id
        matchedMtc.item_code = item.item_code
      } else {
        // If certificate is stored in uploaded cache from ZIP file, create a persistent MTCCertificate entry
        const cacheEntry = (refClean && uploadedCertificatesCache.get(refClean.toLowerCase())) ||
                           (heatUpper && !heatUpper.startsWith('LOT-') && uploadedCertificatesCache.get(heatUpper.toLowerCase()))
        if (cacheEntry) {
          const newCert: MTCCertificate = {
            id: 'MTC-ZIP-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            item_id: item.id,
            item_code: item.item_code,
            stock_lot_id: lotId,
            heat_number: lotData.heat_number,
            l_code: newLot.l_code,
            certificate_reference: cacheEntry.fileName,
            original_file_path: cacheEntry.url,
            purchase_type: lotData.purchase_type,
            supplier_name: lotData.supplier_name,
            upload_date: new Date().toISOString().substring(0, 10),
            uploaded_by: lotData.userEmail || 'System Ingest',
            verification_status: 'Verified',
            approval_status: 'Approved',
            pages: 2,
            yom: lotData.yom || 2025,
            created_at: new Date().toISOString()
          }
          this.mtcs.unshift(newCert)
        }
      }
    }

    const newBalance: StockBalance = {
      id: 'BAL-' + (this.balances.length + 1).toString().padStart(3, '0'),
      stock_lot_id: lotId,
      physical_qty: lotData.quantity,
      reserved_qty: 0,
      available_qty: lotData.quantity,
      dispatched_qty: 0,
      updated_at: new Date().toISOString()
    }

    this.lots.unshift(newLot)
    this.balances.unshift(newBalance)

    // If local purchase, register L-Code
    if (lotData.purchase_type === 'local_purchase') {
      this.localPurchases.unshift({
        id: 'LP-' + Date.now(),
        l_code: newLot.l_code!,
        item_id: item.id,
        item_code: item.item_code,
        stock_lot_id: lotId,
        supplier_name: lotData.supplier_name,
        purchase_reference: `LP-REF-${Date.now().toString().slice(-4)}`,
        purchase_date: new Date().toISOString().substring(0, 10),
        received_qty: lotData.quantity,
        yom: lotData.yom || 2026,
        supplier_mtc_uploaded: false,
        created_by: lotData.userEmail,
        created_at: new Date().toISOString()
      })
    }

    // Ledger Movement
    this.movements.unshift({
      id: 'MOV-' + Date.now(),
      stock_lot_id: lotId,
      item_code: item.item_code,
      heat_number: lotData.heat_number,
      movement_type: 'Stock Receipt',
      quantity: lotData.quantity,
      reference_type: 'GRN',
      reference_id: `GRN-${new Date().toISOString().substring(0, 10)}`,
      previous_balance: 0,
      new_balance: lotData.quantity,
      performed_by: lotData.userEmail,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      remarks: `Received ${lotData.quantity} PCS from ${lotData.supplier_name} (Heat: ${lotData.heat_number})`
    })

    this.saveAll()
    this.logAudit(lotData.userEmail, 'Add Stock Lot', 'Stock Inventory', lotData.heat_number, null, newLot)
    this.notify()

    return { success: true, lot: newLot }
  }

  // Upload and Stamp Local Purchase Supplier MTC
  public uploadAndStampSupplierMTC(localPurchaseId: string, certRef: string, stampedPdfUrl: string, userEmail: string) {
    const lp = this.localPurchases.find(p => p.id === localPurchaseId)
    if (!lp) return { success: false, message: 'Local purchase record not found' }

    const lot = this.lots.find(l => l.id === lp.stock_lot_id)
    if (!lot) return { success: false, message: 'Linked stock lot not found' }

    lp.supplier_mtc_uploaded = true

    const certId = 'MTC-LOC-' + Date.now()
    const newCert: MTCCertificate = {
      id: certId,
      item_id: lp.item_id,
      item_code: lp.item_code,
      stock_lot_id: lp.stock_lot_id,
      heat_number: lot.heat_number,
      l_code: lp.l_code,
      yom: lp.yom,
      certificate_reference: certRef,
      original_file_path: '/sample-mtc.pdf',
      stamped_file_path: stampedPdfUrl,
      purchase_type: 'local_purchase',
      supplier_name: lp.supplier_name,
      upload_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      uploaded_by: userEmail,
      verification_status: 'Verified',
      approval_status: 'Approved',
      pages: 3,
      created_at: new Date().toISOString()
    }

    this.mtcs.unshift(newCert)
    lp.mtc_certificate_id = certId

    this.saveAll()
    this.logAudit(userEmail, 'Upload & Stamp Supplier MTC', 'MTC Management', certRef, null, { l_code: lp.l_code, heat: lot.heat_number })
    this.notify()

    return { success: true, message: `Supplier MTC uploaded, stamped, and verified for L-Code ${lp.l_code}.`, certificate: newCert }
  }

  // Generate MTC Package for Sales Order
  public markMTCPackageGenerated(orderId: string, packageUrl: string, userEmail: string) {
    const order = this.orders.find(o => o.id === orderId)
    if (!order) return { success: false, message: 'Order not found' }

    order.mtc_package_generated = true
    order.mtc_package_url = packageUrl
    order.status = 'MTC Generated'
    order.updated_at = new Date().toISOString()

    this.saveAll()
    this.logAudit(userEmail, 'Generated MTC Package', 'MTC Management', order.so_number)
    this.notify()

    return { success: true, message: `MTC Package successfully generated for ${order.so_number}.` }
  }

  // Import Excel stock records
  public importExcelStock(records: any[], filename: string, userEmail: string) {
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      const rowNum = i + 2 // Excel 1-based, header row is 1

      if (!row.item_code || !row.heat_number || row.quantity === undefined) {
        failCount++
        errors.push(`Row ${rowNum}: Missing mandatory fields (Item Code, Heat Number, or Quantity).`)
        continue
      }

      let item = this.items.find(it => it.item_code.trim().toUpperCase() === String(row.item_code).trim().toUpperCase())
      if (!item) {
        // Create new item on the fly if needed
        item = {
          id: 'ITEM-' + (this.items.length + 1).toString().padStart(3, '0'),
          item_code: String(row.item_code).trim().toUpperCase(),
          item_description: row.description || `Flange/Fitting ${row.item_code}`,
          material_grade: row.grade || 'SS316/316L',
          specification: row.specification || 'ASME B16.5',
          size: row.size || 'Standard',
          uom: row.uom || 'PCS',
          unit_price_aed: Number(row.unit_price) || 50,
          is_active: true,
          created_at: new Date().toISOString()
        }
        this.items.push(item)
      }

      const purchaseType = String(row.purchase_type).toLowerCase().includes('local') ? 'local_purchase' : 'regular'
      const qty = parseInt(row.quantity, 10) || 0
      const yom = parseInt(row.yom, 10) || 2025

      this.addStockLot({
        item_id: item.id,
        heat_number: String(row.heat_number).trim(),
        yom,
        quantity: qty,
        purchase_type: purchaseType,
        supplier_name: row.supplier || (purchaseType === 'local_purchase' ? 'Local UAE Supplier' : 'International Mill'),
        warehouse_location: row.location || 'LN-EB1',
        l_code: row.l_code ? String(row.l_code).trim() : undefined,
        mtc_ref: row.selected_mtc_ref || undefined,
        userEmail
      })

      successCount++
    }

    const job: ExcelImportJob = {
      id: 'IMP-' + Date.now(),
      filename,
      uploaded_by: userEmail,
      upload_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      import_type: 'Master Stock',
      total_rows: records.length,
      successful_rows: successCount,
      failed_rows: failCount,
      status: failCount === 0 ? 'Completed' : (successCount > 0 ? 'Completed with Errors' : 'Failed'),
      validation_report: errors.length > 0 ? errors.join('\n') : 'All rows validated and imported successfully.'
    }

    this.importJobs.unshift(job)
    this.saveAll()
    this.notify()

    return { success: true, job }
  }

  // Audit Logging
  public logAudit(userEmail: string, action: string, module: string, recordId: string, prev?: any, next?: any, reason?: string) {
    this.audits.unshift({
      id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      user_id: userEmail,
      user_email: userEmail,
      action,
      module,
      record_id: recordId,
      previous_values: prev ? JSON.stringify(prev) : undefined,
      new_values: next ? JSON.stringify(next) : undefined,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason
    })
    saveToStorage('audits', this.audits)
  }

  private saveAll() {
    saveToStorage('customers', this.customers)
    saveToStorage('items', this.items)
    saveToStorage('lots', this.lots)
    saveToStorage('balances', this.balances)
    saveToStorage('orders', this.orders)
    saveToStorage('mtcs', this.mtcs)
    saveToStorage('localPurchases', this.localPurchases)
    saveToStorage('movements', this.movements)
    saveToStorage('approvals', this.approvals)
    saveToStorage('dispatches', this.dispatches)
    saveToStorage('returns', this.returns)
    saveToStorage('adjustments', this.adjustments)
    saveToStorage('audits', this.audits)
    saveToStorage('importJobs', this.importJobs)
    saveToStorage('users', this.users)
  }

  // Bulk Upload Certificates (from ZIP or multi-PDF files)
  public bulkUploadCertificates(
    certFiles: Array<{
      fileName: string
      heatNumber: string
      itemCode?: string
      fileDataUrl?: string
      supplierName?: string
      purchaseType?: 'regular' | 'local_purchase'
      lCode?: string
    }>,
    userEmail: string
  ): {
    total: number
    linkedToStock: number
    unlinked: number
    linkedLots: string[]
  } {
    let linkedCount = 0
    let unlinkedCount = 0
    const linkedLots: string[] = []

    certFiles.forEach((cert, idx) => {
      const cleanHeat = String(cert.heatNumber || '').trim()
      const cleanFileName = cert.fileName.trim()
      const certRef = cleanFileName.replace(/\.[^/.]+$/, '')

      // Find matching stock lots with this heat number
      const matchingLots = this.lots.filter(l => 
        l.heat_number.trim().toUpperCase() === cleanHeat.toUpperCase() ||
        (cleanHeat && l.heat_number.toLowerCase().includes(cleanHeat.toLowerCase()))
      )

      if (matchingLots.length > 0) {
        matchingLots.forEach(lot => {
          lot.mtc_ref = cleanFileName
          linkedLots.push(`${lot.item_code} (Heat ${lot.heat_number})`)
          linkedCount++

          // If local purchase, link L-code
          if (lot.purchase_type === 'local_purchase' && lot.l_code) {
            const lp = this.localPurchases.find(p => p.stock_lot_id === lot.id)
            if (lp) lp.supplier_mtc_uploaded = true
          }

          // Register in MTC list
          const certId = 'MTC-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 1000)
          this.mtcs.unshift({
            id: certId,
            item_id: lot.item_id,
            item_code: lot.item_code,
            stock_lot_id: lot.id,
            heat_number: lot.heat_number,
            l_code: lot.l_code,
            yom: lot.yom,
            certificate_reference: certRef,
            original_file_path: cert.fileDataUrl || '/sample-mtc.pdf',
            purchase_type: lot.purchase_type,
            supplier_name: lot.supplier_name,
            upload_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
            uploaded_by: userEmail,
            verification_status: 'Verified',
            approval_status: 'Approved',
            pages: 2,
            created_at: new Date().toISOString()
          })
        })
      } else {
        // Unmatched certificate - store in registry as available heat certificate
        unlinkedCount++
        const certId = 'MTC-UNLINKED-' + Date.now() + '-' + idx
        this.mtcs.unshift({
          id: certId,
          item_id: 'PENDING',
          item_code: cert.itemCode || 'PENDING-MATCH',
          stock_lot_id: '',
          heat_number: cleanHeat || 'UNKNOWN',
          yom: 2025,
          certificate_reference: certRef,
          original_file_path: cert.fileDataUrl || '/sample-mtc.pdf',
          purchase_type: cert.purchaseType || 'regular',
          supplier_name: cert.supplierName || 'Mill / Supplier',
          upload_date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          uploaded_by: userEmail,
          verification_status: 'Verified',
          approval_status: 'Approved',
          pages: 2,
          created_at: new Date().toISOString()
        })
      }
    })

    this.saveAll()
    this.logAudit(
      userEmail,
      'Bulk Certificate Upload',
      'MTC Management',
      `${certFiles.length} Certificates`,
      null,
      { total: certFiles.length, linkedCount, unlinkedCount }
    )
    this.notify()

    return {
      total: certFiles.length,
      linkedToStock: linkedCount,
      unlinked: unlinkedCount,
      linkedLots
    }
  }

  // Clear all operational inventory and order data for testing fresh upload from 0
  public clearAllData(userEmail: string) {
    this.items = []
    this.lots = []
    this.balances = []
    this.orders = []
    this.mtcs = []
    this.localPurchases = []
    this.movements = []
    this.approvals = []
    this.dispatches = []
    this.returns = []
    this.adjustments = []
    this.importJobs = []

    this.saveAll()
    this.logAudit(userEmail, 'Clear All Data', 'System', 'ALL_OPERATIONAL_TABLES', null, { status: 'Cleared for fresh upload testing' })
    this.notify()
  }

  // Reset to default factory demonstration dataset
  public resetToDefault() {
    localStorage.clear()
    this.init()
    this.notify()
  }

  public resetToDemoData(userEmail?: string) {
    this.customers = [...initialCustomers]
    this.items = [...initialItems]
    this.lots = [...initialLots]
    this.balances = [...initialBalances]
    this.orders = [...initialOrders]
    this.mtcs = [...initialMTCs]
    this.localPurchases = [...initialLocalPurchases]
    this.movements = [...initialMovements]
    this.approvals = []
    this.dispatches = []
    this.returns = []
    this.adjustments = []
    this.importJobs = []
    this.users = [...initialUsers]

    this.saveAll()
    if (userEmail) {
      this.logAudit(userEmail, 'Reset to Demo Data', 'System', 'ALL_TABLES')
    }
    this.notify()
  }
}

export const db = new DBService()
