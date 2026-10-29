import React from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import {
  Package,
  Layers,
  CheckCircle,
  Truck,
  AlertTriangle,
  Clock,
  FileCheck2,
  ShoppingBag,
  XCircle,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react'
import { NavTabId } from '../common/Sidebar'

interface DashboardProps {
  onNavigate: (tab: NavTabId, filter?: string) => void
  onSelectHeat: (heat: string) => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectHeat }) => {
  const { currentRole } = useAuth()

  const masterStock = db.getMasterStockView()
  const orders = db.getOrders()
  const movements = db.getMovements()
  const localPurchases = db.getLocalPurchases()
  const dispatches = db.getDispatches()
  const mtcs = db.getMTCs()

  // Calculated Metrics
  const totalStockItems = masterStock.length
  const totalPhysicalQty = masterStock.reduce((acc, s) => acc + s.physical_qty, 0)
  const totalAvailableQty = masterStock.reduce((acc, s) => acc + s.available_qty, 0)
  const totalReservedQty = masterStock.reduce((acc, s) => acc + s.reserved_qty, 0)
  const totalDispatchedQty = masterStock.reduce((acc, s) => acc + s.dispatched_qty, 0)
  const lowStockItems = masterStock.filter(s => s.available_qty <= 10).length

  const pendingApprovals = orders.filter(o => o.status === 'Pending Storekeeper Approval')
  const approvedAwaitingMTC = orders.filter(o => o.status === 'Approved' && !o.mtc_package_generated)
  const pendingDispatches = orders.filter(o => o.status === 'Approved' || o.status === 'MTC Generated' || o.status === 'Partially Dispatched')
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled')
  const totalLocalPurchases = localPurchases.length
  const totalMTCsUploaded = mtcs.length

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0B2545] to-[#133C55] rounded-xl p-5 text-white shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight">Executive Stock & Operations Overview</h1>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Live Verified
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Real-time heat-traceable stock balances, pending approvals, and mill test certificates for MSG Oilfield Equipment Trading LLC.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('orders')}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <span>+ Create Sales Order</span>
          </button>
          <button
            onClick={() => onNavigate('excel')}
            className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs px-3.5 py-2 rounded-lg border border-slate-600 transition-colors"
          >
            <span>Excel Reports</span>
          </button>
        </div>
      </div>

      {/* 12 Key Performance Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
        {/* Total Stock Items */}
        <div onClick={() => onNavigate('stock')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Stock Lots</span>
            <Package className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{totalStockItems} Lots</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{totalPhysicalQty} PCS Physical</div>
        </div>

        {/* Available Stock */}
        <div onClick={() => onNavigate('stock')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available Stock</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700">{totalAvailableQty} PCS</div>
          <div className="text-[10px] text-emerald-600/80 font-medium mt-0.5">Ready for Allocation</div>
        </div>

        {/* Reserved Stock */}
        <div onClick={() => onNavigate('allocation')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reserved Stock</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-700">{totalReservedQty} PCS</div>
          <div className="text-[10px] text-amber-600/80 font-medium mt-0.5">Committed to Orders</div>
        </div>

        {/* Dispatched Quantity */}
        <div onClick={() => onNavigate('dispatch')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Dispatched Qty</span>
            <Truck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl font-extrabold text-indigo-900">{totalDispatchedQty} PCS</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Supplied to Clients</div>
        </div>

        {/* Low Stock Warning */}
        <div onClick={() => onNavigate('stock')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Low Stock Heats</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-xl font-extrabold text-rose-700">{lowStockItems} Items</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Available &le; 10 PCS</div>
        </div>

        {/* Pending Approvals */}
        <div onClick={() => onNavigate('approvals')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Approval</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-xl font-extrabold text-amber-800">{pendingApprovals.length} Orders</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Storekeeper Queue</div>
        </div>

        {/* Awaiting MTC */}
        <div onClick={() => onNavigate('mtc')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting MTC</span>
            <FileCheck2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-blue-800">{approvedAwaitingMTC.length} Orders</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Approved, need MTC</div>
        </div>

        {/* MTCs Uploaded */}
        <div onClick={() => onNavigate('mtc')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">MTCs in Vault</span>
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{totalMTCsUploaded} Docs</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">EN 10204 3.1 & Stamped</div>
        </div>

        {/* Local Purchase Items */}
        <div onClick={() => onNavigate('local_purchase')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Local Purchases</span>
            <ShoppingBag className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-purple-900">{totalLocalPurchases} L-Codes</div>
          <div className="text-[10px] text-purple-600 mt-0.5">UAE Supplier Sourced</div>
        </div>

        {/* Dispatches Pending */}
        <div onClick={() => onNavigate('dispatch')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Dispatch</span>
            <Truck className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-xl font-extrabold text-teal-900">{pendingDispatches.length} Orders</div>
          <div className="text-[10px] text-teal-600 mt-0.5">Approved Delivery Queue</div>
        </div>

        {/* Cancelled Sales Orders */}
        <div onClick={() => onNavigate('orders', 'Cancelled')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cancelled Orders</span>
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-xl font-extrabold text-red-700">{cancelledOrders.length} History</div>
          <div className="text-[10px] text-red-600 mt-0.5">Reservations Released</div>
        </div>

        {/* Active YOM Traceability */}
        <div onClick={() => onNavigate('traceability')} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all">
          <div className="flex justify-between items-center text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">YOM Traceability</span>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-900">100% Trace</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Year of Mfg Linked</div>
        </div>
      </div>

      {/* Operational Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Storekeeper Approvals Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pending Storekeeper Verification Queue ({pendingApprovals.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate('approvals')}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {pendingApprovals.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">All storekeeper verification items are completed.</div>
            ) : (
              pendingApprovals.map(ord => (
                <div key={ord.id} className="p-3 rounded-lg border border-slate-200 hover:border-amber-400 bg-slate-50/70 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-xs text-[#0B2545]">{ord.so_number}</div>
                      <div className="text-[11px] font-medium text-slate-700">{ord.customer_name}</div>
                      <div className="text-[10px] text-slate-500">PO Ref: {ord.po_number} | Order Date: {ord.order_date}</div>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                      Awaiting Physical Check
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/80 text-[11px]">
                    <span className="text-slate-500">Allocated Heats: </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {ord.allocations.map(a => `${a.heat_number} (${a.allocated_qty} PCS)`).join(', ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Stock Movement Ledger (Audit) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-blue-600"></span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Recent Stock Ledger Movements
              </h2>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center space-x-1"
            >
              <span>Full Ledger</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="mt-3 space-y-2 overflow-y-auto max-h-72">
            {movements.slice(0, 6).map(m => (
              <div key={m.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      m.movement_type === 'Reservation' ? 'bg-amber-100 text-amber-800' :
                      m.movement_type === 'Reservation Release' ? 'bg-emerald-100 text-emerald-800' :
                      m.movement_type === 'Dispatch' ? 'bg-indigo-100 text-indigo-800' :
                      m.movement_type === 'Stock Receipt' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {m.movement_type}
                    </span>
                    <span className="font-bold text-slate-800">{m.item_code}</span>
                    <span
                      onClick={() => onSelectHeat(m.heat_number)}
                      className="text-red-700 hover:underline cursor-pointer font-mono font-bold"
                    >
                      Heat: {m.heat_number}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{m.remarks}</div>
                </div>

                <div className="text-right">
                  <div className="font-extrabold text-slate-900">
                    {m.movement_type === 'Reservation Release' || m.movement_type === 'Stock Receipt' ? '+' : '-'}{m.quantity} PCS
                  </div>
                  <div className="text-[10px] text-slate-400">{m.timestamp.slice(5, 16)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Dispatches & Local Purchases Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Dispatches */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Recent Material Dispatches</h2>
            <button onClick={() => onNavigate('dispatch')} className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center space-x-1">
              <span>View Dispatches</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {dispatches.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">No dispatches recorded yet in this session.</div>
            ) : (
              dispatches.slice(0, 4).map(d => (
                <div key={d.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{d.so_number} &bull; DN: {d.delivery_note_number}</div>
                    <div className="text-[11px] text-slate-600">{d.customer_name}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Dispatched</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{d.dispatch_date}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Local Purchases & L-Codes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Local UAE Purchases (L-Codes)</h2>
            <button onClick={() => onNavigate('local_purchase')} className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center space-x-1">
              <span>Manage L-Codes</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {localPurchases.map(lp => (
              <div key={lp.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">{lp.l_code}</span>
                    <span className="font-bold text-slate-800">{lp.item_code}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">Supplier: {lp.supplier_name} | YOM: {lp.yom}</div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    lp.supplier_mtc_uploaded ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {lp.supplier_mtc_uploaded ? 'Stamped MTC' : 'MTC Missing'}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-0.5">{lp.received_qty} PCS Received</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
