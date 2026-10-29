import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { RotateCcw, AlertTriangle, CheckCircle2, Plus, Sliders } from 'lucide-react'

export const ReturnsAndAdjustments: React.FC = () => {
  const { currentUser, hasPermission } = useAuth()
  const returns = db.getReturns()
  const adjustments = db.getAdjustments()
  const masterStock = db.getMasterStockView()
  const orders = db.getOrders()

  const [activeTab, setActiveTab] = useState<'returns' | 'adjustments'>('returns')

  // Return Form State
  const [returnOrderId, setReturnOrderId] = useState('')
  const [returnLotId, setReturnLotId] = useState('')
  const [returnQty, setReturnQty] = useState(1)
  const [returnReason, setReturnReason] = useState('')

  // Adjustment Form State
  const [adjLotId, setAdjLotId] = useState('')
  const [newPhysicalQty, setNewPhysicalQty] = useState(10)
  const [adjReason, setAdjReason] = useState('')

  const canAdjust = hasPermission(['super_admin', 'admin_inventory'])

  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnLotId || returnQty <= 0 || !returnReason.trim()) {
      alert('Please fill all mandatory fields.')
      return
    }

    const res = db.recordMaterialReturn(
      returnOrderId || 'N/A',
      returnLotId,
      Number(returnQty),
      returnReason.trim(),
      currentUser?.email || 'admin@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      setReturnQty(1)
      setReturnReason('')
      setReturnLotId('')
    } else {
      alert(res.message)
    }
  }

  const handleCreateAdjustment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjLotId || newPhysicalQty < 0 || !adjReason.trim()) {
      alert('Please select stock lot, enter new physical quantity and reason.')
      return
    }

    const res = db.adjustStock(
      adjLotId,
      Number(newPhysicalQty),
      adjReason.trim(),
      currentUser?.email || 'admin@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      setAdjReason('')
      setAdjLotId('')
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
            <RotateCcw className="h-5 w-5 text-teal-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Stock Returns & Adjustments Control</h1>
            <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 21 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controlled workflows for customer material returns with quality inspection and authorized stock adjustments.
          </p>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'returns' ? 'bg-[#0B2545] text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Material Returns ({returns.length})
          </button>
          <button
            onClick={() => setActiveTab('adjustments')}
            className={`px-4 py-1.5 rounded-md font-bold transition-all ${
              activeTab === 'adjustments' ? 'bg-[#0B2545] text-white shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock Adjustments ({adjustments.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Material Returns */}
      {activeTab === 'returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Return Form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
              Process Authorized Customer Return
            </h2>

            <form onSubmit={handleCreateReturn} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sales Order Reference (Optional)</label>
                <select
                  value={returnOrderId}
                  onChange={(e) => setReturnOrderId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Non-Order / Stock Return --</option>
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>{o.so_number} - {o.customer_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Returning Heat Lot *</label>
                <select
                  required
                  value={returnLotId}
                  onChange={(e) => setReturnLotId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Choose Stock Lot --</option>
                  {masterStock.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.item_code} | Heat: {s.heat_number} (Avail: {s.available_qty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity Returned (PCS) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Return Reason & Inspection Note *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Client surplus return. Visual inspection: Clean, no pitting or thread damage. Approved for restock."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold py-2.5 rounded-lg shadow"
              >
                Accept Return & Restore to Stock
              </button>
            </form>
          </div>

          {/* Historical Returns List (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
              Authorized Material Returns Ledger
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Sales Order</th>
                    <th className="p-2.5">Item Code</th>
                    <th className="p-2.5">Heat Number</th>
                    <th className="p-2.5 text-center">Qty Returned</th>
                    <th className="p-2.5">Inspection Status</th>
                    <th className="p-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        No customer material returns recorded yet.
                      </td>
                    </tr>
                  ) : (
                    returns.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">{r.return_date}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{r.so_number}</td>
                        <td className="p-2.5 font-mono">{r.item_code}</td>
                        <td className="p-2.5 font-mono font-bold text-red-700">🔥 {r.heat_number}</td>
                        <td className="p-2.5 text-center font-extrabold text-teal-700">+{r.returned_qty} PCS</td>
                        <td className="p-2.5">
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full">
                            {r.acceptance_status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 max-w-xs truncate" title={r.reason}>{r.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Stock Adjustments */}
      {activeTab === 'adjustments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Adjustment Form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-slate-800 pb-2 border-b border-slate-100">
              Manager Stock Adjustment
            </h2>

            {canAdjust ? (
              <form onSubmit={handleCreateAdjustment} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Heat Lot to Adjust *</label>
                  <select
                    required
                    value={adjLotId}
                    onChange={(e) => {
                      setAdjLotId(e.target.value)
                      const lot = masterStock.find(s => s.id === e.target.value)
                      if (lot) setNewPhysicalQty(lot.physical_qty)
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="">-- Choose Stock Lot --</option>
                    {masterStock.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.item_code} | Heat: {s.heat_number} (Current Physical: {s.physical_qty})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New Physical Stock Count (PCS) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPhysicalQty}
                    onChange={(e) => setNewPhysicalQty(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mandatory Business Justification *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Annual stock physical audit discrepancy reconciliation approved by Operations Director."
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0B2545] hover:bg-[#133C55] text-white font-bold py-2.5 rounded-lg shadow"
                >
                  Confirm & Commit Stock Adjustment
                </button>
              </form>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                You do not have administrative permission to execute stock adjustments. Please log in as Super Admin or Inventory Manager.
              </div>
            )}
          </div>

          {/* Historical Adjustments List (2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
              Stock Adjustment Audit Records
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Item Code</th>
                    <th className="p-2.5">Heat Number</th>
                    <th className="p-2.5 text-center">Previous Qty</th>
                    <th className="p-2.5 text-center">New Count</th>
                    <th className="p-2.5 text-center">Net Variance</th>
                    <th className="p-2.5">Authorized By</th>
                    <th className="p-2.5">Justification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400">
                        No manual stock adjustments recorded.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map(adj => (
                      <tr key={adj.id} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-500">{adj.created_at.substring(0, 10)}</td>
                        <td className="p-2.5 font-mono">{adj.item_code}</td>
                        <td className="p-2.5 font-mono font-bold text-red-700">🔥 {adj.heat_number}</td>
                        <td className="p-2.5 text-center text-slate-500">{adj.original_balance}</td>
                        <td className="p-2.5 text-center font-bold text-slate-900">{adj.adjusted_balance}</td>
                        <td className="p-2.5 text-center font-extrabold">
                          <span className={adj.difference_qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {adj.difference_qty > 0 ? '+' : ''}{adj.difference_qty}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{adj.approved_by}</td>
                        <td className="p-2.5 text-slate-600 max-w-xs truncate" title={adj.reason}>{adj.reason}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
