import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { exportMasterStock } from '../../services/excelEngine'
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  FileCheck2,
  AlertTriangle,
  Flame,
  Calendar,
  Building,
  CheckCircle,
  ExternalLink,
  FolderArchive,
  RefreshCw,
} from 'lucide-react'

interface MasterStockProps {
  onSelectHeat: (heat: string) => void
  onOpenImport: () => void
  onPreviewMTC: (docName: string, itemCode: string, heat: string) => void
}

export const MasterStock: React.FC<MasterStockProps> = ({ onSelectHeat, onOpenImport, onPreviewMTC }) => {
  const { hasPermission, currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'local_purchase'>('all')
  const [missingMTCOnly, setMissingMTCOnly] = useState(false)
  const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false)

  // New lot form state
  const [newItemId, setNewItemId] = useState('')
  const [newHeatNumber, setNewHeatNumber] = useState('')
  const [newYom, setNewYom] = useState<number>(2025)
  const [newQty, setNewQty] = useState<number>(10)
  const [newPurchaseType, setNewPurchaseType] = useState<'regular' | 'local_purchase'>('regular')
  const [newSupplier, setNewSupplier] = useState('')
  const [newLocation, setNewLocation] = useState('LN-EB1')
  const [newLCode, setNewLCode] = useState('')

  const stockView = db.getMasterStockView()
  const items = db.getItems()

  // Filtered Stock List
  const filteredStock = stockView.filter(s => {
    const matchesSearch =
      s.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.heat_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.l_code && s.l_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.warehouse_location.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === 'all' || s.purchase_type === typeFilter
    const matchesMTC = !missingMTCOnly || s.mtc_status === 'Missing MTC'

    return matchesSearch && matchesType && matchesMTC
  })

  const canAddStock = hasPermission(['super_admin', 'admin_inventory'])

  const handleAddLotSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemId || !newHeatNumber || newQty <= 0) {
      alert('Please fill all mandatory fields.')
      return
    }

    const res = db.addStockLot({
      item_id: newItemId,
      heat_number: newHeatNumber.trim(),
      yom: Number(newYom) || 2025,
      quantity: Number(newQty),
      purchase_type: newPurchaseType,
      supplier_name: newSupplier || (newPurchaseType === 'local_purchase' ? 'Local Supplier UAE' : 'International Mill'),
      warehouse_location: newLocation,
      l_code: newLCode.trim() || undefined,
      userEmail: currentUser?.email || 'admin@msgoilfield.ae'
    })

    if (res.success) {
      alert(`Stock Lot with Heat ${newHeatNumber} successfully added!`)
      setIsAddLotModalOpen(false)
      setNewHeatNumber('')
      setNewLCode('')
    } else {
      alert(res.message || 'Failed to add stock lot')
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Master Stock Inventory</h1>
          <p className="text-xs text-slate-500">
            Traceable physical inventory with verified Heat Numbers, YOM, L-Codes, and live balances.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {canAddStock && (
            <button
              onClick={() => setIsAddLotModalOpen(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <Plus className="h-4 w-4" />
              <span>Register Stock Lot</span>
            </button>
          )}

          <button
            onClick={onOpenImport}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg border border-slate-300 transition-colors flex items-center space-x-1.5"
          >
            <Upload className="h-3.5 w-3.5 text-slate-600" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => exportMasterStock()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Stock (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Item Code, Heat#, L-Code, Warehouse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-slate-800"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold text-slate-600">Purchase Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium focus:ring-red-500"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular Mill Stock</option>
              <option value="local_purchase">Local Purchase (L-Codes)</option>
            </select>
          </div>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={missingMTCOnly}
              onChange={(e) => setMissingMTCOnly(e.target.checked)}
              className="rounded text-red-600 focus:ring-red-500"
            />
            <span>Missing MTC Warning Only</span>
          </label>
        </div>
      </div>

      {/* Master Stock Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B2545] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Item Code & Description</th>
                <th className="py-3 px-3">Heat Number</th>
                <th className="py-3 px-3">YOM</th>
                <th className="py-3 px-3">Purchase Type</th>
                <th className="py-3 px-3">L-Code</th>
                <th className="py-3 px-3 text-center">Physical</th>
                <th className="py-3 px-3 text-center">Reserved</th>
                <th className="py-3 px-3 text-center">Available</th>
                <th className="py-3 px-3 text-center">Dispatched</th>
                <th className="py-3 px-3">Warehouse</th>
                <th className="py-3 px-3">MTC Certificate</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="bg-slate-100 h-12 w-12 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <FolderArchive className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-slate-800">
                        {stockView.length === 0 ? 'Inventory is Currently Clean (Test Mode)' : 'No stock lots match the filter criteria'}
                      </div>
                      <p className="text-xs text-slate-500">
                        {stockView.length === 0 
                          ? 'All inventory has been cleared so you can test uploading your 6-column Excel file and ZIP certificate archive from scratch.' 
                          : 'Try clearing your search terms or filters to see all available stock lots.'}
                      </p>
                      {stockView.length === 0 && (
                        <div className="flex justify-center items-center gap-2 pt-1">
                          <button
                            onClick={onOpenImport}
                            className="bg-[#0B2545] hover:bg-[#133C55] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow flex items-center space-x-1.5"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>Upload 6-Column Excel File</span>
                          </button>
                          <button
                            onClick={() => db.resetToDemoData()}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-lg border border-slate-300 flex items-center space-x-1.5"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Restore Demo Data</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStock.map((s, idx) => {
                  const isLowStock = s.available_qty <= 10
                  const isMissingMTC = s.mtc_status === 'Missing MTC'
                  const isMissingYOM = !s.yom

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Item Code & Description */}
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="font-mono font-bold text-slate-900">{s.item_code}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">{s.item_description}</div>
                        <div className="text-[10px] text-slate-400">{s.material_grade} &bull; {s.size}</div>
                      </td>

                      {/* Clickable Heat Number */}
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => onSelectHeat(s.heat_number)}
                          className="font-mono font-bold text-red-700 hover:text-red-800 hover:underline flex items-center space-x-1"
                          title="Click to view 360° Material Traceability & Order History"
                        >
                          <Flame className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          <span>{s.heat_number}</span>
                        </button>
                        <div className="text-[10px] text-slate-400">{s.supplier_name}</div>
                      </td>

                      {/* YOM */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isMissingYOM ? (
                          <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] flex items-center space-x-1 w-max">
                            <AlertTriangle className="h-3 w-3" />
                            <span>YOM Missing</span>
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {s.yom}
                          </span>
                        )}
                      </td>

                      {/* Purchase Type */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {s.purchase_type === 'local_purchase' ? (
                          <span className="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                            Local Purchase
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                            Regular Mill
                          </span>
                        )}
                      </td>

                      {/* L Code */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {s.l_code ? (
                          <span className="font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            {s.l_code}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Physical */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {s.physical_qty}
                      </td>

                      {/* Reserved */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-bold ${s.reserved_qty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                          {s.reserved_qty}
                        </span>
                      </td>

                      {/* Available */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-extrabold text-[13px] px-2 py-0.5 rounded ${
                          s.available_qty === 0 ? 'bg-red-100 text-red-800' :
                          isLowStock ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {s.available_qty} {s.uom}
                        </span>
                      </td>

                      {/* Dispatched */}
                      <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                        {s.dispatched_qty}
                      </td>

                      {/* Warehouse Location */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="bg-slate-100 font-mono text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                          {s.warehouse_location}
                        </span>
                      </td>

                      {/* MTC Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isMissingMTC ? (
                          <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] flex items-center space-x-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Missing MTC</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => onPreviewMTC(s.mtc_ref || 'sample-mtc.pdf', s.item_code, s.heat_number)}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1 font-semibold"
                          >
                            <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{s.mtc_status}</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectHeat(s.heat_number)}
                          className="text-slate-600 hover:text-red-700 p-1 rounded hover:bg-slate-100 transition-colors"
                          title="View 360 Traceability"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500">
          <div>
            Showing <span className="font-bold text-slate-700">{filteredStock.length}</span> of{' '}
            <span className="font-bold text-slate-700">{stockView.length}</span> stock lots
          </div>
          <div className="flex space-x-4">
            <span>Physical Total: <strong className="text-slate-800">{stockView.reduce((a, b) => a + b.physical_qty, 0)} PCS</strong></span>
            <span>Available Total: <strong className="text-emerald-700">{stockView.reduce((a, b) => a + b.available_qty, 0)} PCS</strong></span>
            <span>Reserved Total: <strong className="text-amber-700">{stockView.reduce((a, b) => a + b.reserved_qty, 0)} PCS</strong></span>
          </div>
        </div>
      </div>

      {/* Register Stock Lot Modal */}
      {isAddLotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase">Register New Stock Lot</h3>
              <button onClick={() => setIsAddLotModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddLotSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Item Code *</label>
                <select
                  required
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Choose Item from Item Master --</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.item_code} - {it.item_description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Heat Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HEAT-9941A"
                    value={newHeatNumber}
                    onChange={(e) => setNewHeatNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Year of Mfg (YOM) *</label>
                  <input
                    type="number"
                    min="2010"
                    max="2030"
                    required
                    value={newYom}
                    onChange={(e) => setNewYom(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Received Quantity (PCS) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Purchase Type *</label>
                  <select
                    value={newPurchaseType}
                    onChange={(e) => setNewPurchaseType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="regular">Regular Stock (Mill Certificate)</option>
                    <option value="local_purchase">Local Purchase (Requires L-Code & Stamp)</option>
                  </select>
                </div>
              </div>

              {newPurchaseType === 'local_purchase' && (
                <div>
                  <label className="block font-semibold text-amber-800 mb-1">L-Code (Local Purchase Identifier)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if blank (e.g. L-WSO80150-10)"
                    value={newLCode}
                    onChange={(e) => setNewLCode(e.target.value)}
                    className="w-full border border-amber-300 bg-amber-50/50 rounded-lg p-2 font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Mill Name</label>
                  <input
                    type="text"
                    placeholder="e.g. WMASS Germany"
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warehouse Location</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddLotModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Commit Stock Lot to Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
