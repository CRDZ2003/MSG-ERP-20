import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { exportDispatches } from '../../services/excelEngine'
import { SalesOrder } from '../../types'
import {
  Truck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  FileText,
  User,
  PackageCheck,
  ArrowRight,
} from 'lucide-react'

export const DispatchManager: React.FC = () => {
  const { currentUser, hasPermission } = useAuth()
  const orders = db.getOrders()
  const dispatches = db.getDispatches()

  // Eligible for dispatch: Approved, MTC Generated, or Partially Dispatched
  const eligibleOrders = orders.filter(o =>
    o.status === 'Approved' || o.status === 'MTC Generated' || o.status === 'Partially Dispatched'
  )

  const [selectedOrderId, setSelectedOrderId] = useState<string>(eligibleOrders[0]?.id || '')
  const [deliveryNote, setDeliveryNote] = useState(`DN-2026-${Math.floor(Math.random() * 9000 + 1000)}`)
  const [deliveryRef, setDeliveryRef] = useState('LOG-TRUCK-04')
  const [remarks, setRemarks] = useState('Delivered via MSG Logistics. Customer signed receipt copy attached.')
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({})

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

  // Initialize dispatch quantities to remaining allocated quantities
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    const ord = orders.find(o => o.id === orderId)
    if (ord) {
      const initialQtys: Record<string, number> = {}
      ord.allocations.forEach(a => {
        initialQtys[a.id] = Math.max(0, a.allocated_qty - a.dispatched_qty)
      })
      setDispatchQuantities(initialQtys)
    }
  }

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    const dispatchItems = Object.entries(dispatchQuantities)
      .map(([allocId, qty]) => ({ allocation_id: allocId, dispatch_qty: Number(qty) }))
      .filter(x => x.dispatch_qty > 0)

    if (dispatchItems.length === 0) {
      alert('Please enter dispatched quantities greater than zero.')
      return
    }

    const res = db.confirmDispatch(
      selectedOrder.id,
      dispatchItems,
      deliveryNote.trim(),
      deliveryRef.trim(),
      currentUser?.email || 'dispatch@msgoilfield.ae',
      remarks.trim()
    )

    if (res.success) {
      alert(res.message)
      setDeliveryNote(`DN-2026-${Math.floor(Math.random() * 9000 + 1000)}`)
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
            <Truck className="h-5 w-5 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Material Dispatch & Logistics</h1>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 20 Protocol
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Execute partial and complete dispatches against storekeeper-approved allocations with Delivery Note generation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportDispatches()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Dispatch Register (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Dispatch Preparation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Orders Awaiting Dispatch */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
            Eligible Approved Orders ({eligibleOrders.length})
          </h2>

          <div className="space-y-2">
            {eligibleOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No orders currently eligible for dispatch. Orders must be approved by Storekeeper.
              </div>
            ) : (
              eligibleOrders.map(ord => {
                const isSelected = selectedOrderId === ord.id

                return (
                  <div
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-[#0B2545]">{ord.so_number}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mt-1">{ord.customer_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">PO: {ord.po_number}</div>

                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                      <span>Heats: {ord.allocations.length}</span>
                      <span className="text-indigo-700 font-bold">Ready to Ship</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Execution Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
          {!selectedOrder ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Select an approved Sales Order from the queue on the left to prepare the dispatch record.
            </div>
          ) : (
            <form onSubmit={handleConfirmDispatch} className="space-y-5 text-xs">
              {/* Order Banner */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="font-mono font-bold text-sm text-[#0B2545]">{selectedOrder.so_number}</span>
                  <span className="ml-2 font-bold text-slate-800">&bull; {selectedOrder.customer_name}</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    PO Ref: {selectedOrder.po_number} | Storekeeper Approved: {selectedOrder.approved_by || 'Yes'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                    Verification Complete
                  </span>
                </div>
              </div>

              {/* Items Allocation & Dispatch Quantity Input */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700">
                  Allocated Heats & Dispatch Quantities (Support Partial Shipment)
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Heat Number</th>
                      <th className="p-2.5 text-center">Allocated</th>
                      <th className="p-2.5 text-center">Dispatched Prior</th>
                      <th className="p-2.5 text-center">Remaining Balance</th>
                      <th className="p-2.5 text-center font-bold text-indigo-700">This Dispatch (PCS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.allocations.map(alloc => {
                      const remainingAlloc = Math.max(0, alloc.allocated_qty - alloc.dispatched_qty)
                      const currentVal = dispatchQuantities[alloc.id] ?? remainingAlloc

                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-800 font-bold">
                            {selectedOrder.items.find(i => i.id === alloc.sales_order_item_id)?.item_code}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-red-700">
                            🔥 {alloc.heat_number}
                          </td>
                          <td className="p-2.5 text-center font-semibold text-slate-700">
                            {alloc.allocated_qty} PCS
                          </td>
                          <td className="p-2.5 text-center text-slate-500">
                            {alloc.dispatched_qty} PCS
                          </td>
                          <td className="p-2.5 text-center font-bold text-amber-700">
                            {remainingAlloc} PCS
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max={remainingAlloc}
                              value={currentVal}
                              onChange={(e) => {
                                setDispatchQuantities({
                                  ...dispatchQuantities,
                                  [alloc.id]: Math.min(remainingAlloc, Number(e.target.value))
                                })
                              }}
                              className="border border-indigo-300 bg-indigo-50/40 rounded-lg p-1.5 w-24 text-center font-extrabold text-indigo-900"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Delivery Details Inputs */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Delivery Note Number *</label>
                  <input
                    type="text"
                    required
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transport / Vehicle Ref</label>
                  <input
                    type="text"
                    value={deliveryRef}
                    onChange={(e) => setDeliveryRef(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Dispatch Remarks</label>
                  <textarea
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  />
                </div>
              </div>

              {/* Confirm Dispatch Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-6 py-2.5 rounded-lg shadow-md transition-colors flex items-center space-x-2"
                >
                  <PackageCheck className="h-4 w-4" />
                  <span>Confirm Dispatch & Update Physical Inventory</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Dispatches History Register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
          Historical Material Dispatch Log
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Delivery Note</th>
                <th className="p-2.5">Sales Order</th>
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Items Dispatched</th>
                <th className="p-2.5">Transport Ref</th>
                <th className="p-2.5">Dispatched By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">
                    No dispatches executed yet.
                  </td>
                </tr>
              ) : (
                dispatches.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-mono font-bold text-indigo-900">{d.delivery_note_number}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-800">{d.so_number}</td>
                    <td className="p-2.5 font-medium text-slate-800">{d.customer_name}</td>
                    <td className="p-2.5 text-slate-500">{d.dispatch_date}</td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1">
                        {d.items_summary.map((it, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-800 font-mono text-[10px] px-1.5 py-0.5 rounded">
                            {it.item_code} [{it.heat_number}]: {it.quantity} PCS
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-600">{d.dispatch_reference}</td>
                    <td className="p-2.5 text-slate-600">{d.dispatched_by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
