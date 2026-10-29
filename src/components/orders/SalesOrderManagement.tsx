import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { SalesOrder } from '../../types'
import { exportSalesOrders } from '../../services/excelEngine'
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
  const [cancelModalOrder, setCancelModalOrder] = useState<SalesOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // New Order Form state
  const [customerId, setCustomerId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderLines, setOrderLines] = useState<{ itemId: string; requiredQty: number }[]>([
    { itemId: '', requiredQty: 5 }
  ])

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

    const res = db.createSalesOrder({
      customer_id: customerId,
      po_number: poNumber || 'PO-VALUED',
      required_delivery_date: deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: orderLines.map(l => ({ item_id: l.itemId, required_qty: Number(l.requiredQty) })),
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      setIsCreateModalOpen(false)
      setOrderLines([{ itemId: '', requiredQty: 5 }])
      setCustomerId('')
      setPoNumber('')
      // Direct user straight to allocation
      onNavigateToAllocation(res.order.id)
    } else {
      alert(res.message || 'Error creating sales order')
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

        <div className="flex items-center space-x-2">
          {canCreateOrder && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create Sales Order</span>
            </button>
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

      {/* Sales Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
            No Sales Orders found matching the criteria.
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
                        <span>Allocate Stock</span>
                      </button>
                    )}

                    {order.status === 'Stock Allocated' && (
                      <button
                        onClick={() => handleSubmitForStoreApproval(order)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow"
                      >
                        Submit for Storekeeper Check
                      </button>
                    )}

                    {!isCancelled && !isDispatched && (
                      <button
                        onClick={() => setCancelModalOrder(order)}
                        className="text-red-600 hover:bg-red-50 font-semibold text-xs px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* Items & Allocations Detail Table */}
                <div className="p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Order Line Items & Allocated Heats</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-100 text-[10px] uppercase">
                          <th className="pb-1.5">Item Code & Specification</th>
                          <th className="pb-1.5 text-center">Required Qty</th>
                          <th className="pb-1.5 text-center">Allocated Qty</th>
                          <th className="pb-1.5 text-center">Dispatched Qty</th>
                          <th className="pb-1.5">Allocated Heat Numbers</th>
                          <th className="pb-1.5">Line Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.items.map(item => {
                          const itemAllocations = order.allocations.filter(a => a.sales_order_item_id === item.id)

                          return (
                            <tr key={item.id} className="py-2">
                              <td className="py-2">
                                <span className="font-mono font-bold text-slate-800">{item.item_code}</span>
                                <div className="text-[11px] text-slate-500">{item.item_description}</div>
                              </td>
                              <td className="py-2 text-center font-bold text-slate-900">{item.required_qty} {item.uom}</td>
                              <td className="py-2 text-center font-bold text-amber-700">{item.allocated_qty} {item.uom}</td>
                              <td className="py-2 text-center font-bold text-indigo-700">{item.dispatched_qty} {item.uom}</td>
                              <td className="py-2">
                                {itemAllocations.length === 0 ? (
                                  <span className="text-slate-400 italic">No heat allocated yet</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {itemAllocations.map(a => (
                                      <span
                                        key={a.id}
                                        className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold ${
                                          a.allocation_status === 'Released'
                                            ? 'bg-red-100 text-red-700 line-through'
                                            : a.allocation_status === 'Dispatched'
                                            ? 'bg-indigo-100 text-indigo-800'
                                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        }`}
                                      >
                                        Heat: {a.heat_number} ({a.allocated_qty} PCS)
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="py-2">
                                <span className="font-medium text-slate-600">{item.line_status}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Cancellation Reason Note if cancelled */}
                  {isCancelled && (
                    <div className="mt-3 p-3 bg-red-100/70 border border-red-200 rounded-lg text-xs text-red-900">
                      <span className="font-bold">Cancellation Record: </span>
                      <span>Order was cancelled on {order.cancellation_date}. </span>
                      <span className="italic">Reason: "{order.cancellation_reason}"</span>
                      <div className="text-[11px] text-red-700 mt-0.5">
                        &bull; All outstanding reserved stocks have been safely restored to available inventory. Historical audit log preserved.
                      </div>
                    </div>
                  )}

                  {/* Storekeeper verification remarks */}
                  {order.store_remarks && !isCancelled && (
                    <div className="mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                      <span className="font-bold">Storekeeper Note: </span>
                      <span>{order.store_remarks}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Create Sales Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase">Create New Sales Order</h3>
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
                  <label className="block font-semibold text-slate-700 mb-1">Customer P.O. Number</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-ADNOC-7701"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
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

                <div className="space-y-2">
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
                          className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-center"
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

      {/* Cancel Order Confirmation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-bold text-sm uppercase">Cancel Sales Order {cancelModalOrder.so_number}</h3>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-700">
                Are you sure you want to cancel order <strong>{cancelModalOrder.so_number}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                <span className="font-bold">Automated Reversal Policy: </span>
                Any reserved stock allocations will be immediately released and restored back to available stock. Dispatched items (if any) will NOT be reversed without an approved Return.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mandatory Cancellation Reason *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Client requested cancellation due to project scope change..."
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
                  No, Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Confirm Cancellation & Release Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
