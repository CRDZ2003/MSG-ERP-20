import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { SalesOrder } from '../../types'
import {
  exportSalesOrders,
  generateSalesOrderTemplate,
  parseSalesOrderExcel,
} from '../../services/excelEngine'
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  FileCheck2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Download,
  FileUp,
  Paperclip,
  Sparkles,
  ExternalLink,
  ShoppingCart,
} from 'lucide-react'

interface SalesOrderManagementProps {
  onSelectOrder: (order: SalesOrder) => void
  onNavigateToAllocation: (orderId: string) => void
  initialStatusFilter?: string
}

export const SalesOrderManagement: React.FC<SalesOrderManagementProps> = ({
  onSelectOrder,
  onNavigateToAllocation,
  initialStatusFilter,
}) => {
  const { hasPermission, currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [cancelModalOrder, setCancelModalOrder] = useState<SalesOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // New Order Form state
  const [customerId, setCustomerId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderLines, setOrderLines] = useState<{ itemId: string; requiredQty: number }[]>([
    { itemId: '', requiredQty: 5 }
  ])
  const [poFile, setPoFile] = useState<File | null>(null)

  // Excel SO Import state
  const [importFileName, setImportFileName] = useState('')
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([])
  const [isImportingSO, setIsImportingSO] = useState(false)

  const orders = db.getOrders()
  const customers = db.getCustomers()
  const items = db.getItems()

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.so_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.po_number.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const canCreateOrder = hasPermission(['super_admin', 'sales_team', 'admin_inventory'])

  const handleAddLine = () => {
    setOrderLines([...orderLines, { itemId: '', requiredQty: 1 }])
  }

  const handleRemoveLine = (idx: number) => {
    if (orderLines.length === 1) return
    setOrderLines(orderLines.filter((_, i) => i !== idx))
  }

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId || orderLines.some(l => !l.itemId || l.requiredQty <= 0)) {
      alert('Please select customer and valid items with required quantities.')
      return
    }

    let docUrl: string | undefined = undefined
    if (poFile) {
      docUrl = URL.createObjectURL(poFile)
    }

    const res = db.createSalesOrder({
      customer_id: customerId,
      po_number: poNumber || 'PO-VALUED',
      required_delivery_date: deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: orderLines.map(l => ({ item_id: l.itemId, required_qty: Number(l.requiredQty) })),
      po_document_name: poFile ? poFile.name : undefined,
      po_document_url: docUrl,
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      setIsCreateModalOpen(false)
      setOrderLines([{ itemId: '', requiredQty: 5 }])
      setCustomerId('')
      setPoNumber('')
      setPoFile(null)
      // Direct user straight to allocation
      onNavigateToAllocation(res.order.id)
    } else {
      alert(res.message || 'Error creating sales order')
    }
  }

  // Handle Excel SO file upload
  const handleExcelSOChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    try {
      const rows = await parseSalesOrderExcel(file)
      setParsedImportRows(rows)
    } catch (err: any) {
      alert('Failed to parse Sales Order spreadsheet: ' + err.message)
    }
  }

  // Commit Excel SO import
  const handleCommitSOImport = () => {
    if (parsedImportRows.length === 0) return
    setIsImportingSO(true)

    try {
      const res = db.importSalesOrdersFromExcel(
        parsedImportRows,
        currentUser?.email || 'sales@msgoilfield.ae'
      )

      if (res.success) {
        alert(res.message)
        setIsImportModalOpen(false)
        setParsedImportRows([])
        setImportFileName('')
      } else {
        alert(res.message)
      }
    } catch (err: any) {
      alert('Error importing Sales Orders: ' + err.message)
    } finally {
      setIsImportingSO(false)
    }
  }

  // Load a quick sample test order for testing
  const handleLoadSampleOrder = () => {
    const cust = customers[0] || { id: 'CUST-001', customer_name: 'McDermott Middle East Inc' }
    const itm1 = items[0] || { id: 'ITEM-001' }
    const itm2 = items[1] || { id: 'ITEM-002' }

    const res = db.createSalesOrder({
      customer_id: cust.id,
      po_number: `PO-TEST-${Date.now().toString().slice(-4)}`,
      required_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: [
        { item_id: itm1.id, required_qty: 5 },
        { item_id: itm2.id, required_qty: 10 }
      ],
      po_document_name: 'Customer_PO_Approved.pdf',
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      onNavigateToAllocation(res.order.id)
    }
  }

  const handleConfirmCancel = () => {
    if (!cancelModalOrder || !cancelReason.trim()) {
      alert('Please provide a reason for order cancellation.')
      return
    }

    const res = db.cancelSalesOrder(
      cancelModalOrder.id,
      cancelReason.trim(),
      currentUser?.email || 'admin@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      setCancelModalOrder(null)
      setCancelReason('')
    } else {
      alert(res.message)
    }
  }

  const handleSubmitForStoreApproval = (order: SalesOrder) => {
    const res = db.submitForApproval(order.id, currentUser?.email || 'sales@msgoilfield.ae')
    if (res.success) {
      alert(res.message)
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Sales Orders Management</h1>
          <p className="text-xs text-slate-500">
            Create customer orders, allocate Heat Numbers via FIFO or manual selection, and track approval & dispatch status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateOrder && (
            <>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sales Order</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                title="Upload Sales Orders from an Excel spreadsheet"
              >
                <FileUp className="h-4 w-4" />
                <span>Upload SO (.xlsx)</span>
              </button>
            </>
          )}

          <button
            onClick={() => exportSalesOrders()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Orders (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SO#, Customer, PO Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="Draft">Draft</option>
            <option value="Stock Allocated">Stock Allocated</option>
            <option value="Pending Storekeeper Approval">Pending Store Approval</option>
            <option value="Approved">Approved</option>
            <option value="MTC Generated">MTC Generated</option>
            <option value="Partially Dispatched">Partially Dispatched</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Cancelled">Cancelled (Historical)</option>
          </select>
        </div>
      </div>

      {/* Sales Orders List / Actionable Empty State */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-lg mx-auto my-6 space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
              <ShoppingCart className="h-7 w-7" />
            </div>

            <div>
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">No Sales Orders Found</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You can create a customer sales order using the interactive form, attach a PO document, or upload orders in bulk from an Excel spreadsheet.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {canCreateOrder && (
                <>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Order (Form)</span>
                  </button>

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <FileUp className="h-4 w-4" />
                    <span>Upload from Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleLoadSampleOrder}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Load Demo Order</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isCancelled = order.status === 'Cancelled'
            const isDispatched = order.status === 'Dispatched'
            const isApproved = order.status === 'Approved' || order.status === 'MTC Generated'
            const canAllocate = order.status === 'Draft' || order.status === 'Stock Allocated'

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
                  isCancelled ? 'border-red-200 bg-red-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Order Summary Top Bar */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-[#0B2545]">{order.so_number}</span>
                    <span className="text-xs font-semibold text-slate-700">&bull; {order.customer_name}</span>
                    <span className="text-xs text-slate-400">PO: {order.po_number}</span>
                    {order.po_document_name && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <Paperclip className="h-3 w-3" />
                        <span>{order.po_document_name}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isCancelled ? 'bg-red-100 text-red-800' :
                      isDispatched ? 'bg-emerald-100 text-emerald-800' :
                      order.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'MTC Generated' ? 'bg-indigo-100 text-indigo-800' :
                      order.status === 'Pending Storekeeper Approval' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {order.status}
                    </span>

                    {/* Action buttons */}
                    {canAllocate && (
                      <button
                        onClick={() => onNavigateToAllocation(order.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow"
                      >
                        <Flame className="h-3.5 w-3.5" />
                        <span>Allocate Stock (FIFO / Manual)</span>
                      </button>
                    )}

                    {order.status === 'Stock Allocated' && (
                      <button
                        onClick={() => handleSubmitForStoreApproval(order)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Submit for Store Approval</span>
                      </button>
                    )}

                    {!isCancelled && !isDispatched && canCreateOrder && (
                      <button
                        onClick={() => setCancelModalOrder(order)}
                        className="text-slate-400 hover:text-red-600 font-semibold text-xs p-1.5 rounded"
                        title="Cancel Sales Order"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="p-4">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="pb-2">Item Code</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-center">Required</th>
                        <th className="pb-2 text-center">Allocated</th>
                        <th className="pb-2 text-center">Dispatched</th>
                        <th className="pb-2">Allocated Heat Numbers</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.items.map(item => {
                        const itemAllocations = order.allocations.filter(a => a.sales_order_item_id === item.id)

                        return (
                          <tr key={item.id}>
                            <td className="py-2.5 font-mono font-bold text-slate-800">{item.item_code}</td>
                            <td className="py-2.5 text-slate-600">{item.item_description}</td>
                            <td className="py-2.5 text-center font-bold text-slate-900">{item.required_qty} {item.uom}</td>
                            <td className="py-2.5 text-center font-semibold text-blue-700">{item.allocated_qty} {item.uom}</td>
                            <td className="py-2.5 text-center font-semibold text-emerald-700">{item.dispatched_qty} {item.uom}</td>
                            <td className="py-2.5">
                              {itemAllocations.length === 0 ? (
                                <span className="text-slate-400 italic text-[11px]">Unallocated</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {itemAllocations.map(a => (
                                    <span
                                      key={a.id}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        a.allocation_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                                        a.allocation_status === 'Released' ? 'bg-slate-100 text-slate-500 line-through' :
                                        'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {a.heat_number} ({a.allocated_qty} PCS)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                item.line_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                                item.line_status === 'Allocated' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.line_status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Audit Footer */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap justify-between items-center text-[11px] text-slate-400">
                    <div>
                      <span>Created: {order.order_date} by {order.created_by}</span>
                      {order.approved_by && <span className="ml-2 font-semibold text-blue-700">&bull; Approved by {order.approved_by}</span>}
                      {order.cancellation_reason && (
                        <span className="ml-2 text-red-600 font-semibold">&bull; Cancelled: {order.cancellation_reason} ({order.cancellation_date})</span>
                      )}
                    </div>
                    <div>
                      <span>Delivery Target: {order.required_delivery_date || 'Standard'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* CREATE ORDER MODAL (WITH PO DOCUMENT ATTACHMENT) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Plus className="h-4 w-4 text-red-400" />
                <h3 className="font-bold text-sm uppercase">Create Customer Sales Order</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customer_name} ({c.customer_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer P.O. Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-ADNOC-7701"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                {/* Upload Customer PO Document */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload Customer PO Document (PDF / Scan)</label>
                  <div className="relative border border-slate-300 rounded-lg p-1.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setPoFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span className="text-[11px] text-slate-600 truncate max-w-[170px]">
                      {poFile ? poFile.name : 'Select PO document...'}
                    </span>
                    <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Order Lines */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Requested Material Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    + Add Another Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderLines.map((line, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <select
                          required
                          value={line.itemId}
                          onChange={(e) => {
                            const updated = [...orderLines]
                            updated[idx].itemId = e.target.value
                            setOrderLines(updated)
                          }}
                          className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-xs"
                        >
                          <option value="">-- Select Product Item Code --</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>{it.item_code} - {it.item_description}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.requiredQty}
                          onChange={(e) => {
                            const updated = [...orderLines]
                            updated[idx].requiredQty = Number(e.target.value)
                            setOrderLines(updated)
                          }}
                          placeholder="Qty PCS"
                          className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold"
                        />
                      </div>

                      {orderLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-red-600 px-2 py-1 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Save & Proceed to Heat Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD SALES ORDERS FROM EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm uppercase">Upload Sales Orders (.xlsx / .csv)</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-600">Upload bulk customer purchase orders in spreadsheet format.</span>
                <button
                  type="button"
                  onClick={generateSalesOrderTemplate}
                  className="text-emerald-700 font-bold hover:underline flex items-center space-x-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download SO Template (.xlsx)</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 transition-colors relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelSOChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileUp className="h-8 w-8 text-indigo-500 mx-auto mb-1.5" />
                <div className="font-bold text-slate-700">Click or Drop Sales Orders Spreadsheet (.xlsx)</div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Columns: Customer Name, Customer P.O., Item Name, Required Qty, Required Delivery Date
                </p>
                {importFileName && (
                  <div className="mt-2 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 py-1 px-3 rounded inline-block border border-indigo-200">
                    Loaded: {importFileName} ({parsedImportRows.length} items parsed)
                  </div>
                )}
              </div>

              {parsedImportRows.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">
                    Parsed Orders Preview ({parsedImportRows.length} Line Items)
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="p-2">Customer</th>
                          <th className="p-2">P.O. Number</th>
                          <th className="p-2">Item Code</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2">Target Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{r.customerName}</td>
                            <td className="p-2 font-mono text-slate-600">{r.poNumber}</td>
                            <td className="p-2 font-mono font-bold text-blue-700">{r.itemCode}</td>
                            <td className="p-2 text-center font-bold text-slate-900">{r.requiredQty} PCS</td>
                            <td className="p-2 text-slate-500">{r.deliveryDate || 'Standard'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSOImport}
                disabled={isImportingSO || parsedImportRows.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs shadow flex items-center space-x-1.5"
              >
                <span>{isImportingSO ? 'Importing Orders...' : `Commit ${parsedImportRows.length} Items into Sales Orders`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SALES ORDER MODAL */}
      {cancelModalOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-bold text-sm uppercase">Cancel Sales Order: {cancelModalOrder.so_number}</h3>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900">
                <div className="font-bold">Important Audit Notice:</div>
                <div className="mt-1 text-[11px] leading-relaxed">
                  Per MSG Oilfield quality standards, cancelled orders remain permanently archived for full audit traceability. Un-dispatched stock allocations will be immediately restored to available inventory.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Cancellation *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Customer cancelled project PO, or specifications changed."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Confirm Order Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
