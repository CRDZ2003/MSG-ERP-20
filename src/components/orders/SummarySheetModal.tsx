import React, { useState } from 'react'
import {
  X,
  FileSpreadsheet,
  Download,
  Eye,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Truck,
  FileText,
  Layers,
  Building,
  CheckCircle2,
  Package,
  Box,
} from 'lucide-react'
import { SalesOrder, SalesOrderItem } from '../../types'
import { db } from '../../services/db'
import {
  SourcingWorksheetData,
  SourcingLineItem,
  generateStickerSummaryExcel,
  generateClientSummaryExcel,
  generateStoresSummaryExcel,
  generateCIPLLogisticExcel,
  autoDetectMake,
  autoDetectSupplier,
  autoDetectCountryOfOrigin,
  autoDetectHSCode,
  estimateUnitWeight,
} from '../../services/sourcingEngine'
import {
  generateStickersPdf,
  downloadStickerPdfBlob,
  StickerItem,
} from '../../services/stickerEngine'

interface SummarySheetModalProps {
  isOpen: boolean
  onClose: () => void
  order: SalesOrder
  onOrderUpdated: (updatedOrder: SalesOrder) => void
}

const COMMON_SUPPLIERS = [
  'DELCORTE SAS',
  'BENKAN CORP',
  'MEGA S.P.A.',
  'BOTH-WELL STEEL',
  'TK BEND CO. LTD',
  'ULMA PIPING',
  'INTERFIT',
  'LOCAL UAE SUPPLIER',
]

export const SummarySheetModal: React.FC<SummarySheetModalProps> = ({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
}) => {
  if (!isOpen || !order) return null

  // Header State
  const [clientName, setClientName] = useState(order.customer_name || '')
  const [poNumber, setPoNumber] = useState(order.po_number || '')
  const [msgRef, setMsgRef] = useState(order.msg_ref || order.so_number || '')
  const [orderDate, setOrderDate] = useState(order.order_date || new Date().toISOString().substring(0, 10))
  const [currency, setCurrency] = useState<'USD' | 'AED'>('USD')

  // Items State
  const masterStock = db.getMasterStockView()
  const initialItems: SourcingLineItem[] = (order.items || []).map((item, idx) => {
    const alloc = order.allocations?.find(a => (a.sales_order_item_id || a.so_item_id) === item.id)
    const lot = alloc ? masterStock.find(s => s.id === alloc.stock_lot_id) : undefined
    const heat = alloc?.heat_number || item.heat_number || lot?.heat_number || ''
    const cert = item.certificate_number || (lot as any)?.certificate_reference || ''
    const make = item.make || autoDetectMake(item.item_description) || (idx === 0 ? 'DELCORTE, FRANCE' : 'BENKAN, THAILAND')
    const supp = item.supplier_name || lot?.supplier_name || autoDetectSupplier(make, item.item_description || '')
    const pkgType = item.package_type || 'Pallet'
    const pkgNo = item.package_no || '1'
    const hs = autoDetectHSCode(item.item_description)
    const origin = autoDetectCountryOfOrigin(make, item.item_description)
    const qty = alloc?.allocated_qty || item.required_qty || 1
    const unitWeight = estimateUnitWeight(item.item_description, item.uom)

    // Clean remarks - strictly NO location numbers like AC9 / BB9
    let cleanRemarks = item.remarks || ''
    if (/^(?:LOC|LN|LOCATION)[-:\s]*\w+$/i.test(cleanRemarks.trim())) {
      cleanRemarks = ''
    }

    return {
      id: item.id || `ITEM-${idx + 1}`,
      sl_no: item.position || idx + 1,
      client_po_item_no: item.client_po_item_no || (item.position ? String(item.position) : `${idx + 1}`),
      description: item.item_description || item.item_code,
      qty,
      uom: item.uom || 'Ea',
      heat_number: heat,
      certificate_number: cert,
      make,
      remarks: cleanRemarks,
      supplier_name: supp,
      supplier_po_number: (item as any).supplier_po_number || `MSG-PO-${(order.so_number || '2026').replace(/[^0-9]/g, '').slice(-4) || '1844'}`,
      hs_code: hs,
      country_of_origin: origin,
      unit_price: 125,
      total_price: 125 * qty,
      unit_weight_kg: unitWeight,
      total_net_weight_kg: unitWeight * qty,
      total_gross_weight_kg: unitWeight * qty * 1.05,
      package_type: pkgType,
      package_no: pkgNo,
      is_machined: false,
    }
  })

  const [items, setItems] = useState<SourcingLineItem[]>(initialItems)
  const [selectedIds, setSelectedIds] = useState<string[]>(initialItems.map(i => i.id))
  const [isExporting, setIsExporting] = useState(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [showBulkToolbar, setShowBulkToolbar] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Bulk Allocation Fields
  const [bulkSupplier, setBulkSupplier] = useState('')
  const [bulkPO, setBulkPO] = useState('')
  const [bulkMake, setBulkMake] = useState('')
  const [bulkHeat, setBulkHeat] = useState('')
  const [bulkCert, setBulkCert] = useState('')
  const [bulkPkgType, setBulkPkgType] = useState('')
  const [bulkPkgNo, setBulkPkgNo] = useState('')

  // Build current worksheet payload
  const buildCurrentPayload = (): SourcingWorksheetData => ({
    id: order.id,
    client: clientName.trim(),
    po_number: poNumber.trim(),
    msg_ref: msgRef.trim() || order.so_number,
    order_date: orderDate,
    delivery_date: order.required_delivery_date,
    currency,
    port_of_loading: 'Jebel Ali, UAE',
    port_of_discharge: 'Khalifa Bin Salman Port, Bahrain',
    vessel_flight: 'MAERSK LINE / SEA FREIGHT',
    payment_terms: '30 Days Net from Delivery',
    invoice_number: `INV-MSG-${order.so_number.replace(/[^0-9]/g, '').slice(-4) || '2026'}`,
    items,
  })

  // Select / Deselect all
  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map(i => i.id) : [])
  }

  const handleToggleRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // Quick packaging setter: All Pallet, All Box, All Crate
  const handleSetAllPackaging = (pkgType: string) => {
    const targetIds = selectedIds.length > 0 ? selectedIds : items.map(i => i.id)
    setItems(prev =>
      prev.map(it => {
        if (!targetIds.includes(it.id)) return it
        return {
          ...it,
          package_type: pkgType
        }
      })
    )
    setSuccessBanner(`Updated packaging to "${pkgType}" for ${targetIds.length} item(s)!`)
    setTimeout(() => setSuccessBanner(null), 3000)
  }

  // Bulk fill selected items
  const handleApplyBulkAllocation = () => {
    if (selectedIds.length === 0) {
      alert('Please select at least one item using the checkboxes on the left.')
      return
    }
    if (!bulkSupplier && !bulkPO && !bulkMake && !bulkHeat && !bulkCert && !bulkPkgType && !bulkPkgNo) {
      alert('Please fill in at least one field (Supplier, PO#, Make, Heat, Cert, Package Type, or Package #).')
      return
    }

    setItems(prev =>
      prev.map(it => {
        if (!selectedIds.includes(it.id)) return it
        return {
          ...it,
          supplier_name: bulkSupplier.trim() || it.supplier_name,
          supplier_po_number: bulkPO.trim() || it.supplier_po_number,
          make: bulkMake.trim() || it.make,
          heat_number: bulkHeat.trim() || it.heat_number,
          certificate_number: bulkCert.trim() || it.certificate_number,
          package_type: bulkPkgType.trim() || it.package_type,
          package_no: bulkPkgNo.trim() || it.package_no,
        }
      })
    )

    setSuccessBanner(`Applied bulk allocation details to ${selectedIds.length} item(s)!`)
    setTimeout(() => setSuccessBanner(null), 3500)
    setShowBulkToolbar(false)
  }

  // Apply Changes Everywhere & Save to DB
  const handleApplyEverywhere = () => {
    const updatedItemsPayload: Partial<SalesOrderItem>[] = items.map((it, idx) => ({
      id: it.id,
      position: it.sl_no || idx + 1,
      client_po_item_no: it.client_po_item_no,
      item_description: it.description,
      required_qty: it.qty,
      uom: it.uom,
      heat_number: it.heat_number,
      certificate_number: it.certificate_number,
      make: it.make,
      remarks: it.remarks,
      supplier_name: it.supplier_name,
      supplier_po_number: it.supplier_po_number,
      package_type: it.package_type || 'Pallet',
      package_no: it.package_no || '1',
    }))

    const res = db.updateSalesOrder({
      id: order.id,
      customer_name: clientName.trim(),
      po_number: poNumber.trim(),
      so_number: msgRef.trim() || order.so_number,
      items: updatedItemsPayload,
    })

    if (res.success && res.order) {
      setSuccessBanner(`Changes successfully applied everywhere! Sales Order ${res.order.so_number} updated in ERP.`)
      onOrderUpdated(res.order)
      setTimeout(() => setSuccessBanner(null), 4000)
    } else {
      alert(res.message || 'Error updating Sales Order')
    }
  }

  // Download Summary Sheet (.xlsx)
  const handleDownloadSummarySheet = async () => {
    setIsExporting(true)
    try {
      const payload = buildCurrentPayload()
      await generateStickerSummaryExcel(payload)
      setSuccessBanner('Summary Sheet (.xlsx) exported successfully with accurate MSG Ref, Remarks & Transmittal!')
      setTimeout(() => setSuccessBanner(null), 3500)
    } catch (err: any) {
      alert('Error generating Summary Sheet: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Download Client Summary (.xlsx)
  const handleDownloadClientSummary = async () => {
    setIsExporting(true)
    try {
      await generateClientSummaryExcel(buildCurrentPayload(), false)
      setSuccessBanner('Client Summary (.xlsx) downloaded successfully!')
      setTimeout(() => setSuccessBanner(null), 3500)
    } catch (err: any) {
      alert('Error exporting Client Summary: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Download Stores Summary (.xlsx)
  const handleDownloadStoresSummary = async () => {
    setIsExporting(true)
    try {
      await generateStoresSummaryExcel(buildCurrentPayload(), false)
      setSuccessBanner('Stores Sheet (.xlsx) with supplier details downloaded successfully!')
      setTimeout(() => setSuccessBanner(null), 3500)
    } catch (err: any) {
      alert('Error exporting Stores Summary: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Download CIPL (.xlsx)
  const handleDownloadCIPL = async () => {
    setIsExporting(true)
    try {
      await generateCIPLLogisticExcel(buildCurrentPayload())
      setSuccessBanner('CIPL Logistics (.xlsx) downloaded successfully!')
      setTimeout(() => setSuccessBanner(null), 3500)
    } catch (err: any) {
      alert('Error generating CIPL Excel: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Download 58x39mm Stickers (.pdf)
  const handleDownloadStickers = async () => {
    setIsExporting(true)
    try {
      const stickerItems: StickerItem[] = items.map((it, idx) => ({
        sl_no: it.sl_no || idx + 1,
        client_po_item_no: it.client_po_item_no || String(idx + 1),
        description: it.description,
        po_qty: String(it.qty || 1),
        uom: it.uom || 'Ea',
        heat_number: it.heat_number || '-',
        certificate_number: it.certificate_number || '-',
        make: it.make || '-',
        remarks: it.remarks || '',
        loc: '',
        client_name: clientName,
        po_number: poNumber,
      }))

      const pdfBytes = await generateStickersPdf(stickerItems, {
        client_name: clientName,
        po_number: poNumber,
      })
      downloadStickerPdfBlob(pdfBytes, `${msgRef || order.so_number}_58x39mm_Item_Stickers.pdf`)
      setSuccessBanner('58mm × 39mm Stickers PDF downloaded successfully!')
      setTimeout(() => setSuccessBanner(null), 3500)
    } catch (err: any) {
      alert('Error generating stickers: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Add Item Row
  const handleAddRow = () => {
    const newSl = items.length + 1
    const newItem: SourcingLineItem = {
      id: `ITEM-NEW-${Date.now()}`,
      sl_no: newSl,
      client_po_item_no: String(newSl),
      description: 'NEW OILFIELD MATERIAL FITTING',
      qty: 1,
      uom: 'PCS',
      heat_number: '',
      certificate_number: '',
      make: 'BENKAN THAILAND',
      remarks: '',
      supplier_name: 'BENKAN CORP',
      supplier_po_number: `MSG-PO-${(msgRef || order.so_number).replace(/[^0-9]/g, '').slice(-4) || '1844'}`,
      hs_code: '7307.93.00',
      country_of_origin: 'Thailand',
      unit_price: 100,
      total_price: 100,
      unit_weight_kg: 1.0,
      total_net_weight_kg: 1.0,
      total_gross_weight_kg: 1.1,
      package_no: `BOX-${Math.floor(items.length / 3) + 1}`,
      is_machined: false,
    }
    setItems([...items, newItem])
    setSelectedIds([...selectedIds, newItem.id])
  }

  // Remove Item Row
  const handleRemoveRow = (id: string) => {
    if (items.length <= 1) {
      alert('At least one line item must remain.')
      return
    }
    setItems(items.filter(it => it.id !== id))
    setSelectedIds(selectedIds.filter(x => x !== id))
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Summary Sheet & Sourcing Live Preview
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/30 text-orange-300 border border-orange-500/40">
                  {msgRef || order.so_number}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                View &amp; edit sheet details, allocate suppliers &amp; PO numbers in bulk, and apply changes everywhere.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-800 font-semibold animate-in slide-in-from-top-1">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50 text-xs">
          
          {/* Header Details Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wide flex items-center space-x-1.5">
                <Building className="h-3.5 w-3.5 text-orange-600" />
                <span>Header Details (Live Editable)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Correct values here will be printed on all exported sheets and certificates.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Client Name</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="e.g. OIS MIDDLE EAST TRADING LLC"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer PO Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={e => setPoNumber(e.target.value)}
                  placeholder="e.g. PO261393B"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  MSG Ref / Sales Order #
                </label>
                <input
                  type="text"
                  value={msgRef}
                  onChange={e => setMsgRef(e.target.value)}
                  placeholder="e.g. MSG-1126-2227"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-800 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none bg-orange-50/30 text-orange-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="AED">AED (AED - UAE Dirham)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <label className="inline-flex items-center space-x-2 font-bold text-slate-700 cursor-pointer mr-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onChange={e => handleSelectAll(e.target.checked)}
                  className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
                />
                <span className="text-xs">
                  Select All ({selectedIds.length} of {items.length})
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowBulkToolbar(!showBulkToolbar)}
                className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors text-xs"
              >
                <Building className="h-3.5 w-3.5 text-orange-600" />
                <span>Supplier PO / Allocate</span>
              </button>

              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">Set Packaging:</span>

              <button
                type="button"
                onClick={() => handleSetAllPackaging('Pallet')}
                className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 text-xs transition-colors"
                title="Set packaging to Pallet for selected items"
              >
                <Package className="h-3.5 w-3.5 text-sky-600" />
                <span>All Pallet</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetAllPackaging('Box')}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 text-xs transition-colors"
                title="Set packaging to Box for selected items"
              >
                <Box className="h-3.5 w-3.5 text-amber-600" />
                <span>All Box</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetAllPackaging('Crate')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 text-xs transition-colors"
                title="Set packaging to Crate for selected items"
              >
                <Layers className="h-3.5 w-3.5 text-slate-600" />
                <span>All Crate</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center space-x-1 transition-colors text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          {/* Bulk Allocation Drawer */}
          {showBulkToolbar && (
            <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm space-y-3 animate-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-orange-900 text-xs">
                    Bulk Allocate to {selectedIds.length} Selected Item(s):
                  </span>
                  <span className="text-[11px] text-orange-700">
                    Fill in details and click Apply. Empty fields leave existing values untouched.
                  </span>
                </div>
                <button
                  onClick={() => setShowBulkToolbar(false)}
                  className="text-orange-600 hover:text-orange-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Supplier Name</label>
                  <input
                    type="text"
                    list="modalSuppliersList"
                    value={bulkSupplier}
                    onChange={e => setBulkSupplier(e.target.value)}
                    placeholder="e.g. DELCORTE SAS"
                    className="w-full border border-orange-300 rounded px-2 py-1 text-xs bg-white font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <datalist id="modalSuppliersList">
                    {COMMON_SUPPLIERS.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Supplier PO #</label>
                  <input
                    type="text"
                    value={bulkPO}
                    onChange={e => setBulkPO(e.target.value)}
                    placeholder="e.g. MSG-PO-2227"
                    className="w-full border border-orange-300 rounded px-2 py-1 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Package Type</label>
                  <select
                    value={bulkPkgType}
                    onChange={e => setBulkPkgType(e.target.value)}
                    className="w-full border border-orange-300 rounded px-2 py-1 text-xs bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">(Keep Existing)</option>
                    <option value="Pallet">Pallet</option>
                    <option value="Box">Box</option>
                    <option value="Crate">Crate</option>
                    <option value="Wooden Box">W.Box</option>
                    <option value="Carton">Carton</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Package #</label>
                  <input
                    type="text"
                    value={bulkPkgNo}
                    onChange={e => setBulkPkgNo(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full border border-orange-300 rounded px-2 py-1 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">MAKE</label>
                  <input
                    type="text"
                    value={bulkMake}
                    onChange={e => setBulkMake(e.target.value)}
                    placeholder="e.g. DELCORTE, FRANCE"
                    className="w-full border border-orange-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Heat Number</label>
                  <input
                    type="text"
                    value={bulkHeat}
                    onChange={e => setBulkHeat(e.target.value)}
                    placeholder="e.g. 68C00M098"
                    className="w-full border border-orange-300 rounded px-2 py-1 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-orange-900 mb-0.5">Certificate Number</label>
                  <input
                    type="text"
                    value={bulkCert}
                    onChange={e => setBulkCert(e.target.value)}
                    placeholder="e.g. 232442/3"
                    className="w-full border border-orange-300 rounded px-2 py-1 font-mono text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleApplyBulkAllocation}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-4 py-1.5 rounded-lg flex items-center space-x-1.5 shadow-sm text-xs transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply to {selectedIds.length} Selected Item(s)</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive Line Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[46vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onChange={e => handleSelectAll(e.target.checked)}
                        className="rounded text-orange-600 h-3.5 w-3.5"
                      />
                    </th>
                    <th className="p-2 w-12 text-center">Pos</th>
                    <th className="p-2 w-20 text-center">Client PO Item</th>
                    <th className="p-2 min-w-[260px]">Description</th>
                    <th className="p-2 w-16 text-center">PO Qty</th>
                    <th className="p-2 w-14 text-center">UOM</th>
                    <th className="p-2 w-36 bg-sky-900 text-white text-center border-b-2 border-sky-400">
                      PACKAGING (CIPL)<br />
                      <span className="text-[9px] font-normal opacity-90">Pallet / Box / #</span>
                    </th>
                    <th className="p-2 w-28 text-center">Heat Number</th>
                    <th className="p-2 w-32">MAKE</th>
                    <th className="p-2 w-28 text-center">Certificate #</th>
                    <th className="p-2 w-28">Remarks</th>
                    <th className="p-2 w-32 bg-slate-200/50">Supplier Name</th>
                    <th className="p-2 w-24 bg-slate-200/50">Supplier PO #</th>
                    <th className="p-2 w-10 text-center">Act</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {items.map((it, idx) => {
                    const isSelected = selectedIds.includes(it.id)
                    return (
                      <tr key={it.id} className={isSelected ? 'bg-orange-50/30' : 'hover:bg-slate-50/50'}>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(it.id)}
                            className="rounded text-orange-600 h-3.5 w-3.5"
                          />
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-slate-600">
                          {it.sl_no || idx + 1}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={it.client_po_item_no || ''}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].client_po_item_no = e.target.value
                              setItems(updated)
                            }}
                            className="w-16 text-center font-mono text-xs border border-slate-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            rows={2}
                            value={it.description}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].description = e.target.value
                              setItems(updated)
                            }}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-800 leading-snug resize-y"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={it.qty}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].qty = Number(e.target.value)
                              setItems(updated)
                            }}
                            className="w-14 text-center font-bold text-xs border border-slate-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={it.uom}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].uom = e.target.value
                              setItems(updated)
                            }}
                            className="w-12 text-center font-mono text-xs border border-slate-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="p-2 bg-sky-50/50">
                          <div className="flex items-center space-x-1 justify-center">
                            <select
                              value={it.package_type || 'Pallet'}
                              onChange={e => {
                                const updated = [...items]
                                updated[idx].package_type = e.target.value
                                setItems(updated)
                              }}
                              className="w-20 text-[11px] font-bold border border-sky-300 rounded px-1 py-0.5 bg-white text-sky-900 focus:ring-1 focus:ring-sky-500"
                            >
                              <option value="Pallet">Pallet</option>
                              <option value="Box">Box</option>
                              <option value="Crate">Crate</option>
                              <option value="Wooden Box">W.Box</option>
                              <option value="Carton">Carton</option>
                            </select>
                            <input
                              type="text"
                              value={it.package_no || '1'}
                              onChange={e => {
                                const updated = [...items]
                                updated[idx].package_no = e.target.value
                                setItems(updated)
                              }}
                              placeholder="#"
                              title="Pallet / Box Number"
                              className="w-10 text-center font-mono font-bold text-[11px] border border-sky-300 rounded px-1 py-0.5 bg-white text-sky-900 focus:ring-1 focus:ring-sky-500"
                            />
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={it.heat_number}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].heat_number = e.target.value
                              setItems(updated)
                            }}
                            placeholder="Heat #"
                            className="w-24 text-center font-mono font-bold text-xs border border-slate-300 rounded px-1 py-0.5 bg-red-50/40 text-red-700"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={it.make}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].make = e.target.value
                              setItems(updated)
                            }}
                            placeholder="MAKE"
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 font-medium"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={it.certificate_number}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].certificate_number = e.target.value
                              setItems(updated)
                            }}
                            placeholder="Cert #"
                            className="w-24 text-center font-mono text-xs border border-slate-300 rounded px-1 py-0.5"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={it.remarks}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].remarks = e.target.value
                              setItems(updated)
                            }}
                            placeholder="Remarks (clean)"
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 text-slate-700"
                          />
                        </td>
                        <td className="p-2 bg-slate-50/60">
                          <input
                            type="text"
                            list="modalSuppliersList"
                            value={it.supplier_name}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].supplier_name = e.target.value
                              setItems(updated)
                            }}
                            placeholder="Supplier"
                            className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        </td>
                        <td className="p-2 bg-slate-50/60">
                          <input
                            type="text"
                            value={it.supplier_po_number}
                            onChange={e => {
                              const updated = [...items]
                              updated[idx].supplier_po_number = e.target.value
                              setItems(updated)
                            }}
                            placeholder="PO #"
                            className="w-full text-xs font-mono border border-slate-300 rounded px-1.5 py-0.5 bg-white"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(it.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                            title="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Apply everywhere */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleApplyEverywhere}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 shadow-md shadow-orange-500/20 transition-all hover:scale-[1.02]"
              title="Save all changes back into the Sales Order and ERP database so changes reflect everywhere"
            >
              <Check className="h-4 w-4" />
              <span>Apply Everywhere &amp; Save</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
              title="Preview formatted Excel layout before download"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Excel Layout</span>
            </button>
          </div>

          {/* Right: Export Downloads */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. Official Summary Sheet */}
            <button
              type="button"
              onClick={handleDownloadSummarySheet}
              disabled={isExporting}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
              title="Download 9-column Summary Sheet with correct MSG Ref, clean Remarks & Transmittal"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-200" />
              <span>Download Summary Sheet (.xlsx)</span>
            </button>

            {/* 2. Client Summary */}
            <button
              type="button"
              onClick={handleDownloadClientSummary}
              disabled={isExporting}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center space-x-1 shadow-sm transition-colors"
              title="Download Client Technical Summary"
            >
              <FileText className="h-3.5 w-3.5 text-teal-200" />
              <span>Client Summary</span>
            </button>

            {/* 3. Stores Summary */}
            <button
              type="button"
              onClick={handleDownloadStoresSummary}
              disabled={isExporting}
              className="bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center space-x-1 shadow-sm transition-colors"
              title="Download Stores Internal Sheet with supplier details"
            >
              <Layers className="h-3.5 w-3.5 text-purple-200" />
              <span>Stores Sheet</span>
            </button>

            {/* 4. CIPL Logistics */}
            <button
              type="button"
              onClick={handleDownloadCIPL}
              disabled={isExporting}
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center space-x-1 shadow-sm transition-colors"
              title="Download Customs Commercial Invoice & Packing List"
            >
              <Truck className="h-3.5 w-3.5 text-blue-200" />
              <span>CIPL (.xlsx)</span>
            </button>

            {/* 5. Stickers */}
            <button
              type="button"
              onClick={handleDownloadStickers}
              disabled={isExporting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center space-x-1 shadow-sm transition-colors"
              title="Download 58mm × 39mm Thermal Item Stickers"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              <span>Stickers (.pdf)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Visual Excel Layout Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-sm overflow-y-auto p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-sm">Visual Excel Layout Preview</span>
                <span className="text-xs text-slate-400">({items.length} items)</span>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 text-xs font-sans">
              <div className="bg-white border-2 border-slate-400 shadow-md p-6 max-w-4xl mx-auto space-y-4">
                
                {/* Excel Title */}
                <div className="text-center font-bold text-base border-b-2 border-slate-300 pb-2">
                  SUMMARY SHEET
                </div>

                {/* Excel Metadata & Logo Grid */}
                <div className="grid grid-cols-3 border border-slate-300 text-xs">
                  <div className="col-span-2 p-2.5 space-y-1 font-bold border-r border-slate-300">
                    <div>Client : {clientName}</div>
                    <div>PO Number: {poNumber}</div>
                    <div>MSG Ref:   {msgRef || order.so_number}</div>
                  </div>
                  <div className="p-2.5 flex items-center justify-center bg-slate-50">
                    <div className="text-center font-bold font-mono text-orange-600">
                      [ MSG OILFIELD LOGO ]
                    </div>
                  </div>
                </div>

                {/* Excel Table */}
                <div className="overflow-x-auto border border-slate-300">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-200/80 font-bold border-b border-slate-300 text-slate-800 text-center">
                        <th className="p-1.5 border-r border-slate-300">Item.CF.Client PO Item No</th>
                        <th className="p-1.5 border-r border-slate-300 text-left">Item Desc</th>
                        <th className="p-1.5 border-r border-slate-300">QuantityOrdered</th>
                        <th className="p-1.5 border-r border-slate-300">Unit</th>
                        <th className="p-1.5 border-r border-slate-300">Heat Number</th>
                        <th className="p-1.5 border-r border-slate-300">Make</th>
                        <th className="p-1.5 border-r border-slate-300">Certificate Number</th>
                        <th className="p-1.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-1.5 text-center font-mono border-r border-slate-200">
                            {it.client_po_item_no || idx + 1}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-left font-sans">
                            {it.description}
                          </td>
                          <td className="p-1.5 text-center font-bold border-r border-slate-200">
                            {it.qty}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200">
                            {it.uom}
                          </td>
                          <td className="p-1.5 text-center font-mono font-bold text-red-700 border-r border-slate-200">
                            {it.heat_number || '-'}
                          </td>
                          <td className="p-1.5 text-center border-r border-slate-200">
                            {it.make || '-'}
                          </td>
                          <td className="p-1.5 text-center font-mono border-r border-slate-200">
                            {it.certificate_number || '-'}
                          </td>
                          <td className="p-1.5 text-center text-slate-700">
                            {it.remarks || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            <div className="px-5 py-3 bg-white border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Exact layout mirroring publication standard template.
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreviewModal(false)
                    handleDownloadSummarySheet()
                  }}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Excel (.xlsx)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
