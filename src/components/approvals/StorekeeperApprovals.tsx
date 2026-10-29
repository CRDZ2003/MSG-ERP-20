import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { SalesOrder } from '../../types'
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  FileCheck2,
  Clock,
  ShieldCheck,
  Building,
} from 'lucide-react'

export const StorekeeperApprovals: React.FC = () => {
  const { hasPermission, currentUser } = useAuth()
  const orders = db.getOrders()
  const masterStock = db.getMasterStockView()

  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const [remarks, setRemarks] = useState('Physical heat numbers, mill markings, and tag numbers verified on site at Yard-1.')
  const [approverName, setApproverName] = useState(currentUser?.employee_name || 'Tariq Al-Hashimi (Yard-1)')

  const pendingOrders = orders.filter(o => o.status === 'Pending Storekeeper Approval')
  const historicalApprovals = orders.filter(o => o.approved_by || o.status === 'Approved' || o.status === 'MTC Generated')

  const canApprove = hasPermission(['super_admin', 'storekeeper'])

  const handleAction = (status: 'Approved' | 'Rejected' | 'Correction Requested') => {
    if (!selectedOrder) return

    if (!approverName.trim()) {
      alert('Please specify the Storekeeper Name.')
      return
    }

    const res = db.storekeeperApprove(selectedOrder.id, approverName.trim(), status, remarks)
    if (res.success) {
      alert(res.message)
      setSelectedOrder(null)
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-5 w-5 text-amber-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Storekeeper Physical Verification Gate</h1>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 11 Compliance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mandatory warehouse inspection of material markings, heat numbers, YOM, and allocated quantities before MTC release.
          </p>
        </div>

        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-lg font-medium">
          Queue: <strong>{pendingOrders.length} Orders Awaiting Verification</strong>
        </div>
      </div>

      {/* Main Approval Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List of Orders Awaiting Check */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
            Awaiting Verification ({pendingOrders.length})
          </h2>

          <div className="space-y-2">
            {pendingOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No Sales Orders currently pending storekeeper physical check.
              </div>
            ) : (
              pendingOrders.map(ord => {
                const isSelected = selectedOrder?.id === ord.id

                return (
                  <div
                    key={ord.id}
                    onClick={() => {
                      setSelectedOrder(ord)
                      setRemarks('Physical heat markings, tags, and material dimensions verified at Yard-1.')
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{ord.so_number}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Pending Check
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mt-1">{ord.customer_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">PO Ref: {ord.po_number}</div>

                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                      <span>Heats to Verify: </span>
                      <span className="font-mono font-semibold text-slate-900">
                        {ord.allocations.map(a => a.heat_number).join(', ') || 'None'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Detail Inspection & Approval Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          {!selectedOrder ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Select an order from the verification queue on the left to review physical item details and confirm inspection.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Order Inspection Header */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono font-bold text-sm text-[#0B2545]">{selectedOrder.so_number}</span>
                  <span className="ml-2 font-bold text-slate-800">&bull; {selectedOrder.customer_name}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Order Date: {selectedOrder.order_date} | Required Delivery: {selectedOrder.required_delivery_date}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full uppercase">
                    Physical Check Required
                  </span>
                </div>
              </div>

              {/* Physical Verification Checklist Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700">
                  Physical Stock & Heat Markings Verification Checklist
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Item Code & Description</th>
                      <th className="p-2.5">Allocated Heat Number</th>
                      <th className="p-2.5">YOM</th>
                      <th className="p-2.5">L-Code</th>
                      <th className="p-2.5 text-center">Allocated Qty</th>
                      <th className="p-2.5">Warehouse Location</th>
                      <th className="p-2.5 text-center">Physical Markings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.allocations.map(alloc => {
                      const stockLot = masterStock.find(s => s.id === alloc.stock_lot_id)

                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50">
                          <td className="p-2.5">
                            <span className="font-mono font-bold text-slate-800">{stockLot?.item_code}</span>
                            <div className="text-[10px] text-slate-500 line-clamp-1">{stockLot?.item_description}</div>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-red-700">
                            🔥 {alloc.heat_number}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-700">
                            {stockLot?.yom || 'N/A'}
                          </td>
                          <td className="p-2.5 font-mono text-amber-800 font-semibold">
                            {stockLot?.l_code || '-'}
                          </td>
                          <td className="p-2.5 text-center font-extrabold text-slate-900">
                            {alloc.allocated_qty} PCS
                          </td>
                          <td className="p-2.5 font-mono text-slate-600">
                            {stockLot?.warehouse_location}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-center space-x-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Verified</span>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Approval Remarks and Submission */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspected & Verified By (Storekeeper) *</label>
                    <input
                      type="text"
                      required
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspection Yard / Bay</label>
                    <input
                      type="text"
                      disabled
                      value="MSG Oilfield Yard-1 / Mussafah"
                      className="w-full border border-slate-200 bg-slate-100 rounded-lg p-2 text-slate-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Physical Verification Remarks *</label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleAction('Rejected')}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold"
                  >
                    Reject Allocation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('Correction Requested')}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold"
                  >
                    Request Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction('Approved')}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow flex items-center space-x-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve Physical Stock (Enable MTC Release)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
