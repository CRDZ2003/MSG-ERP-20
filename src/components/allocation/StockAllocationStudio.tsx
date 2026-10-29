import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import {
  Layers,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react'

interface StockAllocationStudioProps {
  preselectedOrderId?: string
  onComplete: () => void
}

export const StockAllocationStudio: React.FC<StockAllocationStudioProps> = ({ preselectedOrderId, onComplete }) => {
  const { currentUser } = useAuth()
  const orders = db.getOrders()
  const masterStock = db.getMasterStockView()

  // Eligible orders (Draft or Stock Allocated)
  const allocatableOrders = orders.filter(o => o.status === 'Draft' || o.status === 'Stock Allocated')
  const [selectedOrderId, setSelectedOrderId] = useState<string>(preselectedOrderId || allocatableOrders[0]?.id || '')

  const currentOrder = orders.find(o => o.id === selectedOrderId)

  // Selected item line to allocate
  const [selectedItemId, setSelectedItemId] = useState<string>(currentOrder?.items[0]?.item_id || '')
  const [allocationMode, setAllocationMode] = useState<'fifo' | 'manual'>('fifo')
  const [manualLotId, setManualLotId] = useState<string>('')
  const [manualQty, setManualQty] = useState<number>(1)

  // Find unallocated quantity for the selected item line
  const currentLine = currentOrder?.items.find(i => i.item_id === selectedItemId)
  const remainingNeeded = currentLine ? Math.max(0, currentLine.required_qty - currentLine.allocated_qty) : 0

  // Matching lots for this item
  const matchingLots = masterStock.filter(s => s.item_id === selectedItemId && s.available_qty > 0)

  // FIFO Preview computation
  const getFIFOPreview = () => {
    if (!remainingNeeded || matchingLots.length === 0) return []
    const sorted = [...matchingLots].sort((a, b) => {
      if (a.stock_receipt_date !== b.stock_receipt_date) return a.stock_receipt_date.localeCompare(b.stock_receipt_date)
      return (a.yom || 2024) - (b.yom || 2024)
    })

    let rem = remainingNeeded
    const plan: { lot: typeof matchingLots[0]; take: number; remainingAvail: number }[] = []

    for (const lot of sorted) {
      if (rem <= 0) break
      const take = Math.min(rem, lot.available_qty)
      plan.push({
        lot,
        take,
        remainingAvail: lot.available_qty - take
      })
      rem -= take
    }
    return plan
  }

  const fifoPlan = getFIFOPreview()

  const handleExecuteFIFO = () => {
    if (!currentOrder || !selectedItemId || remainingNeeded <= 0) {
      alert('No remaining quantity needed or item not selected.')
      return
    }

    const res = db.allocateFIFO(
      currentOrder.id,
      selectedItemId,
      remainingNeeded,
      currentUser?.email || 'sales@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      onComplete()
    } else {
      alert(res.message)
    }
  }

  const handleExecuteManual = () => {
    if (!currentOrder || !selectedItemId || !manualLotId || manualQty <= 0) {
      alert('Please select a specific heat number and quantity.')
      return
    }

    const res = db.allocateManual(
      currentOrder.id,
      selectedItemId,
      manualLotId,
      manualQty,
      currentUser?.email || 'sales@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      onComplete()
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="h-5 w-5 text-red-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Stock Allocation Engine</h1>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 8 & 9 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compare First-In-First-Out (FIFO) automated heat distribution against manual single-heat selection with transactional reservation locks.
          </p>
        </div>

        {/* Order Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-600">Active Sales Order:</span>
          <select
            value={selectedOrderId}
            onChange={(e) => {
              setSelectedOrderId(e.target.value)
              const ord = orders.find(o => o.id === e.target.value)
              if (ord && ord.items[0]) setSelectedItemId(ord.items[0].item_id)
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-bold text-[#0B2545] shadow-sm"
          >
            {allocatableOrders.length === 0 ? (
              <option value="">No draft or unallocated orders</option>
            ) : (
              allocatableOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.so_number} &bull; {o.customer_name} ({o.status})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {!currentOrder ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
          Please select a Sales Order from the dropdown above to begin heat allocation.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Order Items Selector */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                1. Order Lines to Allocate
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{currentOrder.so_number} &bull; {currentOrder.customer_name}</p>
            </div>

            <div className="space-y-2">
              {currentOrder.items.map(item => {
                const isSelected = item.item_id === selectedItemId
                const unalloc = Math.max(0, item.required_qty - item.allocated_qty)
                const isComplete = unalloc === 0

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.item_id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50/40 ring-1 ring-red-400'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-xs text-slate-900">{item.item_code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isComplete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isComplete ? 'Fully Allocated' : `${unalloc} Needed`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{item.item_description}</div>
                    <div className="mt-2 text-xs flex justify-between text-slate-600">
                      <span>Required: <strong>{item.required_qty} PCS</strong></span>
                      <span>Allocated: <strong className="text-emerald-700">{item.allocated_qty} PCS</strong></span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Current Allocations summary for this order */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Committed Heat Reservations</div>
              {currentOrder.allocations.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic">No heats reserved yet for this order.</div>
              ) : (
                <div className="space-y-1.5">
                  {currentOrder.allocations.map(a => (
                    <div key={a.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-slate-800">🔥 Heat {a.heat_number}</span>
                      <span className="font-bold text-emerald-700">{a.allocated_qty} PCS</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (2 cols): Allocation Mode Tabs & Simulator */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
            {/* Mode Switcher */}
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setAllocationMode('fifo')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center space-x-1.5 ${
                  allocationMode === 'fifo' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Method A: Automatic FIFO Allocation (Default)</span>
              </button>
              <button
                onClick={() => setAllocationMode('manual')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center space-x-1.5 ${
                  allocationMode === 'manual' ? 'bg-[#0B2545] text-white shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="h-3.5 w-3.5" />
                <span>Method B: Manual Specific Heat Selection</span>
              </button>
            </div>

            {/* Selected item status */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500">Allocating for: </span>
                <span className="font-mono font-bold text-slate-900">{currentLine?.item_code}</span>
              </div>
              <div>
                <span className="text-slate-500">Unallocated Balance Needed: </span>
                <span className="font-extrabold text-red-700 text-sm">{remainingNeeded} PCS</span>
              </div>
            </div>

            {/* MODE A: FIFO Allocation Plan */}
            {allocationMode === 'fifo' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900">
                  <div className="font-bold flex items-center space-x-1 mb-1">
                    <ShieldCheck className="h-4 w-4 text-blue-700" />
                    <span>FIFO Logic (First-In, First-Out by Receipt Date & YOM)</span>
                  </div>
                  <p className="text-[11px] text-blue-800">
                    The system sequentially reserves stock from the oldest registered lots first. If a lot contains fewer units than requested, it drains that lot and automatically pulls the balance from the next oldest heat.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700">
                    Calculated FIFO Allocation Simulation
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                      <tr>
                        <th className="p-2.5">Heat Number</th>
                        <th className="p-2.5">Receipt Date</th>
                        <th className="p-2.5">YOM</th>
                        <th className="p-2.5 text-center">Available Before</th>
                        <th className="p-2.5 text-center font-bold text-red-700">To Allocate</th>
                        <th className="p-2.5 text-center">Available After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fifoPlan.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">
                            {remainingNeeded === 0
                              ? 'This line item is already fully allocated.'
                              : 'No available stock lots found for this item.'}
                          </td>
                        </tr>
                      ) : (
                        fifoPlan.map(p => (
                          <tr key={p.lot.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-bold text-slate-900">
                              🔥 {p.lot.heat_number}
                              {p.lot.l_code && <span className="ml-1 text-[10px] text-amber-700">({p.lot.l_code})</span>}
                            </td>
                            <td className="p-2.5 text-slate-600">{p.lot.stock_receipt_date}</td>
                            <td className="p-2.5 text-slate-600">{p.lot.yom}</td>
                            <td className="p-2.5 text-center font-medium text-slate-600">{p.lot.available_qty} PCS</td>
                            <td className="p-2.5 text-center font-extrabold text-red-600 bg-red-50/50">
                              {p.take} PCS
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-700">
                              {p.remainingAvail} PCS
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleExecuteFIFO}
                    disabled={remainingNeeded <= 0 || fifoPlan.length === 0}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-2"
                  >
                    <span>Commit FIFO Allocation & Lock Reservation</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* MODE B: Manual Heat Selection */}
            {allocationMode === 'manual' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <div className="font-bold flex items-center space-x-1 mb-1">
                    <Flame className="h-4 w-4 text-amber-700" />
                    <span>Customer Specific Heat Number Request</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Use this mode when a client specifically demands items from one specific heat or YOM batch. You must select a lot with sufficient available stock.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                      Select Eligible Available Heat Lot:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchingLots.map(lot => {
                        const isSelected = manualLotId === lot.id
                        return (
                          <div
                            key={lot.id}
                            onClick={() => {
                              setManualLotId(lot.id)
                              setManualQty(Math.min(remainingNeeded, lot.available_qty))
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#0B2545] bg-blue-50/50 ring-1 ring-blue-700'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono font-bold text-xs text-slate-900">🔥 Heat: {lot.heat_number}</span>
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                {lot.available_qty} PCS Avail
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              YOM: {lot.yom} &bull; Location: {lot.warehouse_location} &bull; Recv: {lot.stock_receipt_date}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {manualLotId && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-3 text-xs">
                      <div>
                        <label className="font-semibold text-slate-700 block mb-1">Quantity to Allocate (PCS):</label>
                        <input
                          type="number"
                          min="1"
                          max={matchingLots.find(l => l.id === manualLotId)?.available_qty || 1}
                          value={manualQty}
                          onChange={(e) => setManualQty(Number(e.target.value))}
                          className="border border-slate-300 rounded-lg p-1.5 w-32 font-bold text-center"
                        />
                      </div>
                      <div className="text-slate-500 text-[11px] pt-4">
                        Max available in this heat: {matchingLots.find(l => l.id === manualLotId)?.available_qty} PCS
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleExecuteManual}
                      disabled={!manualLotId || manualQty <= 0}
                      className="bg-[#0B2545] hover:bg-[#133C55] disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-2"
                    >
                      <span>Commit Manual Heat Allocation</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
