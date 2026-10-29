import React, { useState } from 'react'
import { db } from '../../services/db'
import {
  exportMasterStock,
  exportHeatRegister,
  exportLocalPurchases,
  exportSalesOrders,
  exportStockMovements,
  exportDispatches,
} from '../../services/excelEngine'
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  Truck,
  RotateCcw,
} from 'lucide-react'

export const ReportsCenter: React.FC = () => {
  const stockView = db.getMasterStockView()
  const orders = db.getOrders()
  const movements = db.getMovements()
  const localPurchases = db.getLocalPurchases()
  const mtcs = db.getMTCs()

  const [selectedReport, setSelectedReport] = useState<string>('current_stock')

  const reportsList = [
    { id: 'current_stock', title: '1. Current Stock Report', exportFn: exportMasterStock, count: stockView.length, desc: 'Complete master stock inventory with physical, reserved, and available balances.' },
    { id: 'stock_by_heat', title: '2. Stock by Heat Number Register', exportFn: exportHeatRegister, count: stockView.length, desc: 'Every distinct heat number with corresponding lot location and YOM.' },
    { id: 'stock_by_yom', title: '3. Stock by Year of Manufacturing', exportFn: exportMasterStock, count: stockView.filter(s => s.yom).length, desc: 'Breakdown of inventory sorted by manufacturing year (2023-2026).' },
    { id: 'local_purchases', title: '4. Local Purchase & L-Code Register', exportFn: exportLocalPurchases, count: localPurchases.length, desc: 'Locally sourced stock with assigned L-Codes and supplier MTC status.' },
    { id: 'mtc_register', title: '5. MTC Certificate Register', exportFn: exportMasterStock, count: mtcs.length, desc: 'Catalog of verified and stamped Mill Test Certificates EN 10204 3.1.' },
    { id: 'missing_certificates', title: '6. Missing Certificate Warning Report', exportFn: exportMasterStock, count: stockView.filter(s => s.mtc_status === 'Missing MTC').length, desc: 'Stock items currently lacking required mill or supplier test certificates.' },
    { id: 'missing_yom', title: '7. Missing YOM Audit Report', exportFn: exportMasterStock, count: stockView.filter(s => !s.yom).length, desc: 'Lots flagged for missing Year of Manufacturing data.' },
    { id: 'available_stock', title: '8. Available Stock Ready for Sale', exportFn: exportMasterStock, count: stockView.filter(s => s.available_qty > 0).length, desc: 'Stock immediately available for customer reservation.' },
    { id: 'reserved_stock', title: '9. Reserved Stock Report', exportFn: exportSalesOrders, count: stockView.filter(s => s.reserved_qty > 0).length, desc: 'Quantities committed to pending and approved Sales Orders.' },
    { id: 'dispatched_stock', title: '10. Dispatched Stock Report', exportFn: exportDispatches, count: stockView.filter(s => s.dispatched_qty > 0).length, desc: 'Historical materials successfully supplied to customers.' },
    { id: 'sales_orders', title: '11. Sales Orders Register', exportFn: exportSalesOrders, count: orders.length, desc: 'Comprehensive list of all active and confirmed customer orders.' },
    { id: 'cancelled_orders', title: '12. Cancelled Sales Orders & Reversals', exportFn: exportSalesOrders, count: orders.filter(o => o.status === 'Cancelled').length, desc: 'Audited log of cancelled orders with released reservation details.' },
    { id: 'stock_movements', title: '13. Stock Movements (Ledger)', exportFn: exportStockMovements, count: movements.length, desc: 'Immutable transaction ledger of all receipts, reservations, and dispatches.' },
    { id: 'dispatch_register', title: '14. Material Dispatch Register', exportFn: exportDispatches, count: db.getDispatches().length, desc: 'Delivery notes and transport references for all supplied orders.' },
    { id: 'adjustments_report', title: '15. Stock Adjustments Audit', exportFn: exportMasterStock, count: db.getAdjustments().length, desc: 'Manager-authorized adjustments with before/after variances.' },
  ]

  const currentRep = reportsList.find(r => r.id === selectedReport) || reportsList[0]

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-red-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Executive Reports & Analytics Center</h1>
            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 22 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate, filter, and export verified inventory, traceability, MTC, sales order, and audit reports to Microsoft Excel.
          </p>
        </div>

        <button
          onClick={() => currentRep.exportFn()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export "{currentRep.title.slice(3)}" (.xlsx)</span>
        </button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {reportsList.map(rep => {
          const isSelected = selectedReport === rep.id

          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-xs text-slate-900">{rep.title}</h3>
                <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                  {rep.count} Records
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{rep.desc}</p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-[10px] text-slate-400">Live Supabase Sync</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    rep.exportFn()
                  }}
                  className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center space-x-1 hover:underline"
                >
                  <Download className="h-3 w-3" />
                  <span>Download Excel</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
