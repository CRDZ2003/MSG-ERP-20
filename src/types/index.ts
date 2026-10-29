// Type definitions for MSG Oilfield Equipment Trading LLC ERP

export type UserRole =
  | 'super_admin'
  | 'admin_inventory'
  | 'sales_team'
  | 'storekeeper'
  | 'mtc_controller'
  | 'dispatch_team'
  | 'management_viewer'

export interface UserProfile {
  id: string
  employee_name: string
  email: string
  department: string
  role: UserRole
  account_status: 'Active' | 'Inactive' | 'Suspended'
  created_at: string
  last_login?: string
}

export interface Customer {
  id: string
  customer_code: string
  customer_name: string
  address: string
  contact_details: string
  status: 'Active' | 'Inactive'
  created_at: string
}

export interface Item {
  id: string
  item_code: string
  item_description: string
  material_grade: string
  specification: string
  size: string
  uom: string
  unit_price_aed: number
  is_active: boolean
  created_at: string
}

export type PurchaseType = 'regular' | 'local_purchase'

export interface StockLot {
  id: string
  item_id: string
  item_code: string
  item_description: string
  heat_number: string
  yom: number // Year of Manufacturing (0 or null means not available)
  original_qty: number
  received_qty: number
  purchase_type: PurchaseType
  supplier_name: string
  l_code?: string
  stock_receipt_date: string
  warehouse_location: string
  mtc_ref?: string
  created_at: string
  updated_at: string
}

export interface StockBalance {
  id: string
  stock_lot_id: string
  physical_qty: number
  reserved_qty: number
  available_qty: number
  dispatched_qty: number
  updated_at: string
}

export type SalesOrderStatus =
  | 'Draft'
  | 'Stock Allocated'
  | 'Pending Storekeeper Approval'
  | 'Approved'
  | 'MTC Pending'
  | 'MTC Generated'
  | 'Partially Dispatched'
  | 'Dispatched'
  | 'Cancelled'

export interface SalesOrderItem {
  id: string
  sales_order_id: string
  item_id: string
  item_code: string
  item_description: string
  required_qty: number
  allocated_qty: number
  dispatched_qty: number
  uom: string
  line_status: 'Pending' | 'Allocated' | 'Approved' | 'Dispatched' | 'Cancelled'
}

export interface StockAllocation {
  id: string
  sales_order_item_id: string
  sales_order_id: string
  stock_lot_id: string
  heat_number: string
  allocated_qty: number
  released_qty: number
  dispatched_qty: number
  allocation_status: 'Allocated' | 'Released' | 'Dispatched'
  created_at: string
  updated_at: string
}

export interface SalesOrder {
  id: string
  so_number: string
  po_number: string
  customer_id: string
  customer_name: string
  order_date: string
  required_delivery_date: string
  status: SalesOrderStatus
  created_by: string
  approved_by?: string
  cancellation_date?: string
  cancellation_reason?: string
  store_remarks?: string
  mtc_package_generated: boolean
  mtc_package_url?: string
  po_document_name?: string
  po_document_url?: string
  created_at: string
  updated_at: string
  items: SalesOrderItem[]
  allocations: StockAllocation[]
}

export interface MTCCertificate {
  id: string
  item_id: string
  item_code: string
  stock_lot_id: string
  heat_number: string
  l_code?: string
  yom: number
  certificate_reference: string
  original_file_path: string
  stamped_file_path?: string
  purchase_type: PurchaseType
  supplier_name: string
  upload_date: string
  uploaded_by: string
  verification_status: 'Pending' | 'Verified' | 'Rejected'
  approval_status: 'Pending' | 'Approved' | 'Rejected'
  pages: number
  created_at: string
}

export interface LocalPurchaseRecord {
  id: string
  l_code: string
  item_id: string
  item_code: string
  stock_lot_id: string
  supplier_name: string
  purchase_reference: string
  purchase_date: string
  received_qty: number
  yom: number
  mtc_certificate_id?: string
  supplier_mtc_uploaded: boolean
  created_by: string
  created_at: string
}

export type MovementType =
  | 'Opening Stock'
  | 'Stock Receipt'
  | 'Reservation'
  | 'Reservation Release'
  | 'Dispatch'
  | 'Approved Customer Return'
  | 'Stock Adjustment'
  | 'Adjustment Reversal'

export interface StockMovement {
  id: string
  stock_lot_id: string
  item_code: string
  heat_number: string
  movement_type: MovementType
  quantity: number
  reference_type: string
  reference_id: string
  previous_balance: number
  new_balance: number
  performed_by: string
  timestamp: string
  remarks: string
}

export interface ApprovalRecord {
  id: string
  sales_order_id: string
  so_number: string
  approval_type: 'Storekeeper Physical Verification' | 'MTC Release' | 'Stock Adjustment'
  approval_status: 'Approved' | 'Rejected' | 'Correction Requested'
  approved_by: string
  approval_date: string
  rejection_reason?: string
  remarks?: string
}

export interface DispatchRecord {
  id: string
  sales_order_id: string
  so_number: string
  dispatch_reference: string
  dispatch_date: string
  delivery_note_number: string
  customer_name: string
  dispatched_by: string
  delivery_remarks?: string
  items_summary: {
    item_code: string
    heat_number: string
    quantity: number
  }[]
  created_at: string
}

export interface StockReturn {
  id: string
  sales_order_id: string
  so_number: string
  stock_lot_id: string
  item_code: string
  heat_number: string
  returned_qty: number
  return_date: string
  reason: string
  authorized_by: string
  acceptance_status: 'Pending Inspection' | 'Accepted' | 'Rejected'
  created_at: string
}

export interface StockAdjustment {
  id: string
  stock_lot_id: string
  item_code: string
  heat_number: string
  original_balance: number
  adjusted_balance: number
  difference_qty: number
  reason: string
  requested_by: string
  approved_by?: string
  status: 'Pending Approval' | 'Approved' | 'Rejected'
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  user_email: string
  action: string
  module: string
  record_id: string
  previous_values?: string
  new_values?: string
  timestamp: string
  reason?: string
}

export interface ExcelImportJob {
  id: string
  filename: string
  uploaded_by: string
  upload_date: string
  import_type: 'Master Stock' | 'Sales Orders' | 'MTC Registry'
  total_rows: number
  successful_rows: number
  failed_rows: number
  status: 'Completed' | 'Failed' | 'Completed with Errors'
  validation_report: string
}
