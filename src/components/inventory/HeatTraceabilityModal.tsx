import React from 'react'
import { db } from '../../services/db'
import {
  Flame,
  FileCheck2,
  Calendar,
  Layers,
  Truck,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Download,
  Building,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface HeatTraceabilityModalProps {
  heatNumber: string
  onClose: () => void
  onPreviewMTC: (docName: string, itemCode: string, heat: string) => void
}

export const HeatTraceabilityModal: React.FC<HeatTraceabilityModalProps> = ({ heatNumber, onClose, onPreviewMTC }) => {
  const stockView = db.getMasterStockView()
  const orders = db.getOrders()
  const mtcs = db.getMTCs()
  const movements = db.getMovements()

  const lot = stockView.find(s => s.heat_number === heatNumber)
  const linkedMTC = mtcs.find(m => m.heat_number === heatNumber)

  // Find all Sales Orders that allocated or touched this heat number
  const associatedOrders = orders.filter(o =>
    o.allocations.some(a => a.heat_number === heatNumber)
  )

  // Associated ledger movements for this heat
  const heatMovements = movements.filter(m => m.heat_number === heatNumber)

  if (!lot) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
          <h3 className="font-bold text-slate-800">Heat Number Not Found</h3>
          <p className="text-xs text-slate-500 mt-1">No active stock lot found for Heat: {heatNumber}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Modal Header */}
        <div className="bg-[#0B2545] p-5 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <Flame className="h-5 w-5 text-red-500" />
              <h2 className="text-base font-extrabold uppercase tracking-wide">360° Material Traceability Register</h2>
              <span className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                Heat: {lot.heat_number}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              End-to-end lifecycle traceability from mill manufacturing receipt to client dispatches & historical order records.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-lg p-1">✕</button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Stock & Manufacturing Lot Overview */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
              <span>1. Stock Lot & Material Properties</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block">Item Code</span>
                <span className="font-mono font-bold text-slate-900">{lot.item_code}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Year of Mfg (YOM)</span>
                <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded inline-block">
                  {lot.yom || 'YOM Not Available'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Purchase Type</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {lot.purchase_type === 'local_purchase' ? 'Local UAE Purchase' : 'Regular Mill Stock'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">L-Code (Local Purchase)</span>
                <span className="font-mono font-bold text-amber-800">
                  {lot.l_code || 'N/A (Regular Mill)'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-slate-500 text-[11px] block">Material Description</span>
                <span className="font-medium text-slate-800">{lot.item_description}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Supplier / Mill</span>
                <span className="font-semibold text-slate-800">{lot.supplier_name}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">Warehouse Yard</span>
                <span className="font-mono font-bold text-slate-800">{lot.warehouse_location}</span>
              </div>
            </div>

            {/* Inventory Balance Breakdown */}
            <div className="grid grid-cols-4 gap-3 mt-3 text-center">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="text-[10px] uppercase font-bold text-slate-500">Physical Stock</div>
                <div className="text-lg font-extrabold text-slate-900">{lot.physical_qty} PCS</div>
              </div>
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-amber-700">Reserved</div>
                <div className="text-lg font-extrabold text-amber-800">{lot.reserved_qty} PCS</div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-emerald-700">Available</div>
                <div className="text-lg font-extrabold text-emerald-800">{lot.available_qty} PCS</div>
              </div>
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 shadow-sm">
                <div className="text-[10px] uppercase font-bold text-blue-700">Dispatched</div>
                <div className="text-lg font-extrabold text-blue-800">{lot.dispatched_qty} PCS</div>
              </div>
            </div>
          </div>

          {/* Section 2: Certificate & Stamping Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-1.5">
              <span>2. Material Test Certificate (MTC) Documentation</span>
            </h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                  <FileCheck2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-slate-900">
                    {linkedMTC?.certificate_reference || `MTC-${lot.heat_number}`}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    EN 10204 3.1 Certified &bull; {linkedMTC?.pages || 2} Pages &bull; Uploaded: {linkedMTC?.upload_date || lot.stock_receipt_date}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    Status: {lot.mtc_status}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onPreviewMTC(lot.mtc_ref || 'sample-mtc.pdf', lot.item_code, lot.heat_number)}
                  className="bg-[#0B2545] hover:bg-[#133C55] text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Preview Certificate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Historical Sales Order Lifecycle & Traceability */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Associated Sales Order History (Including Cancelled & Released Orders)
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">{associatedOrders.length} Order Records</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Sales Order No</th>
                    <th className="p-2.5">Customer</th>
                    <th className="p-2.5">Order Date</th>
                    <th className="p-2.5 text-center">Allocated</th>
                    <th className="p-2.5 text-center">Dispatched</th>
                    <th className="p-2.5">Order Status</th>
                    <th className="p-2.5">Cancellation / Reversal Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {associatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400">
                        No Sales Orders have been allocated against this heat number yet.
                      </td>
                    </tr>
                  ) : (
                    associatedOrders.map(ord => {
                      const heatAlloc = ord.allocations.find(a => a.heat_number === heatNumber)
                      const isCancelled = ord.status === 'Cancelled'
                      const isDispatched = ord.status === 'Dispatched'

                      return (
                        <tr key={ord.id} className={isCancelled ? 'bg-red-50/40' : 'hover:bg-slate-50'}>
                          <td className="p-2.5 font-bold font-mono text-slate-900">{ord.so_number}</td>
                          <td className="p-2.5 font-medium text-slate-800">{ord.customer_name}</td>
                          <td className="p-2.5 text-slate-500">{ord.order_date}</td>
                          <td className="p-2.5 text-center font-bold text-slate-900">
                            {heatAlloc?.allocated_qty || 0} PCS
                          </td>
                          <td className="p-2.5 text-center font-bold text-indigo-700">
                            {heatAlloc?.dispatched_qty || 0} PCS
                          </td>
                          <td className="p-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCancelled ? 'bg-red-100 text-red-800' :
                              isDispatched ? 'bg-emerald-100 text-emerald-800' :
                              ord.status === 'Approved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {isCancelled ? (
                              <div>
                                <span className="font-bold text-red-700 text-[10px] block">
                                  Reversed on {ord.cancellation_date}
                                </span>
                                <span className="text-[10px] text-slate-500 italic">
                                  {ord.cancellation_reason}
                                </span>
                              </div>
                            ) : (
                              <span className="text-emerald-700 text-[11px] font-semibold flex items-center space-x-1">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Active Allocation</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Immutable Ledger Movements for this Heat */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              4. Complete Transaction Ledger for Heat {lot.heat_number}
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
              {heatMovements.map(m => (
                <div key={m.id} className="p-2 bg-white rounded border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{m.movement_type}</span>
                    <span className="text-slate-400 text-[11px] ml-2">Ref: {m.reference_id}</span>
                    <div className="text-[10px] text-slate-500">{m.remarks} &bull; By: {m.performed_by}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900">{m.quantity} PCS</span>
                    <div className="text-[10px] text-slate-400">{m.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">
            Registered on {lot.created_at} &bull; MSG Oilfield Equipment Trading LLC Traceability Engine
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-colors"
          >
            Close Traceability View
          </button>
        </div>
      </div>
    </div>
  )
}
