import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Tag,
  Printer,
  Upload,
  RefreshCw,
  FileCheck,
} from 'lucide-react'
import { db } from '../../services/db'
import {
  StickerItem,
  parseExcelForStickers,
  generateStickersPdf,
  downloadStickerPdfBlob,
} from '../../services/stickerEngine'

export const StickerGeneratorPortal: React.FC = () => {
  const [items, setItems] = useState<StickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)

  // Auto-detected Source metadata
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>('')
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  const existingOrders = db.getOrders()

  // 1. AUTOMATICALLY KNOW WHICH DATA/EXCEL SHOULD GET STICKERS ON MOUNT
  useEffect(() => {
    const orders = db.getOrders()
    if (orders.length > 0) {
      const latestOrder = orders[0]
      setSelectedOrderId(latestOrder.id)
      loadOrderItems(latestOrder.id, false)
    }
  }, [])

  // Auto-clear notice after 5 seconds
  useEffect(() => {
    if (successNotice) {
      const timer = setTimeout(() => setSuccessNotice(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successNotice])

  // Helper to load items from Sales Order
  const loadOrderItems = (orderId: string, showNotice: boolean = true) => {
    const order = existingOrders.find(o => o.id === orderId)
    if (!order) return

    setSelectedOrderId(orderId)
    setUploadedFileName(null)

    const orderItems: StickerItem[] = order.items.map((it, idx) => {
      const itAny = it as any
      const pos = itAny.position || idx + 1
      const heat = it.heat_number || itAny.heatNumber || 'REQUIRED'
      const loc = it.location || itAny.remarks || 'BB10'
      return {
        sl_no: pos,
        client_po_item_no: itAny.client_po_item_no || `${pos}`,
        description: it.item_description || `${it.item_code} Oilfield Material`,
        po_qty: it.required_qty,
        uom: it.uom || 'PCS',
        heat_number: heat,
        certificate_number: heat !== 'REQUIRED' ? `MTC-${heat}.pdf` : '-',
        make: itAny.make || 'BENKAN THAILAND',
        remarks_1: itAny.remarks || 'Stock Allocated',
        remarks_2: loc,
        remarks: `${itAny.remarks || ''} ${loc}`.trim(),
        loc: loc,
        location: loc,
        supplier: itAny.supplier_name || 'MSG Internal Stores',
        po_number: order.po_number,
      }
    })

    // Sort strictly by position #
    orderItems.sort((a, b) => {
      const na = parseInt(String(a.sl_no).replace(/\D/g, ''), 10) || 0
      const nb = parseInt(String(b.sl_no).replace(/\D/g, ''), 10) || 0
      return na - nb
    })

    setItems(orderItems)
    setActiveSourceLabel(`Sales Order ${order.so_number} (PO: ${order.po_number || '-'}) • ${order.customer_name}`)

    if (showNotice) {
      setSuccessNotice(`Auto-loaded ${orderItems.length} line items from ${order.so_number} for material stickers!`)
    }
  }

  // Fallback: Optional upload if user wants to supply an alternate Excel file
  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const parsed = await parseExcelForStickers(file)
      if (parsed.length === 0) {
        throw new Error('No valid material rows found in the selected Excel file.')
      }
      setItems(parsed)
      setUploadedFileName(file.name)
      setActiveSourceLabel(`Uploaded Excel File: ${file.name}`)
      setSuccessNotice(`Successfully extracted ${parsed.length} line items from ${file.name}!`)
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to parse Excel file.')
    } finally {
      setLoading(false)
    }
  }

  // 2. GENERATE AND DOWNLOAD PDF MATCHING FINALIZED LAYOUT 1:1
  const handleDownloadStickers = async () => {
    if (items.length === 0) {
      setErrorNotice('No material line items available to generate stickers.')
      return
    }

    setLoading(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const pdfBytes = await generateStickersPdf(items)
      downloadStickerPdfBlob(pdfBytes, 'stickers_msg_final.pdf')
      setSuccessNotice('Finalized Material Stickers PDF generated successfully! Download started.')
    } catch (err: any) {
      console.error('Error generating stickers PDF:', err)
      setErrorNotice(err.message || 'Failed to render stickers PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Authoritative Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                <span>Fully Automated Sync</span>
              </span>
              <span className="text-slate-400 text-xs font-mono">Finalized ReportLab Output</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Material Location Tag &amp; Sticker Generator
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
              Material line items are automatically detected and loaded from the authoritative Sales Order without requiring manual uploads. Generates the exact finalized print-ready A4 PDF (2 tags per page) with official logo, SL NO reference, 20pt bold LOC box, specifications table, and QA/QC sign-off.
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDownloadStickers}
              disabled={loading || items.length === 0}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center space-x-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Compiling Stickers...</span>
                </>
              ) : (
                <>
                  <Printer className="w-5 h-5" />
                  <span>Generate Stickers ({items.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notices */}
        {successNotice && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {errorNotice && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center space-x-2 animate-fade-in">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}
      </div>

      {/* Auto-Detection Status Card */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-center text-emerald-700 shrink-0 shadow-sm">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <span>Auto-Detected Target Material Source</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              {activeSourceLabel || 'Scanning for active orders...'}
            </div>
            <div className="text-xs text-slate-500">
              {items.length} Line items ready • {Math.ceil(items.length / 2)} Pages (2 stickers per A4 sheet)
            </div>
          </div>
        </div>

        {/* Controls: Order selector & Optional Alternate Upload */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {existingOrders.length > 0 && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 flex items-center space-x-2 text-xs">
              <span className="font-bold text-slate-500 uppercase text-[10px] shrink-0">Switch Order:</span>
              <select
                value={selectedOrderId}
                onChange={e => loadOrderItems(e.target.value, true)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer max-w-[220px] truncate"
              >
                {existingOrders.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.so_number} - {o.po_number} ({o.customer_name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Optional Alternate Excel File Upload (Drop-in override) */}
          <label
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs px-3 py-2 rounded-xl border border-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
            title="Upload custom Excel sheet if not using active sales order"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>{uploadedFileName ? 'Change Excel' : 'Upload Alternate Excel'}</span>
            <input
              type="file"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleXlsxUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Content Area: Left Wireframe Preview & Right Items Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Finalized Tag Wireframe Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Tag className="w-4 h-4 text-indigo-700" />
                <span>Exact Layout Preview (2 / A4)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Matches Python ReportLab</span>
            </div>

            {/* Exact Visual Container matching server/loc_labels_generator.py */}
            <div className="border-2 border-[#1E3A8A] rounded-xl overflow-hidden bg-white text-[11px] p-2 space-y-2 shadow-sm">
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 px-1">
                <img src="/logo.png" alt="MSG Logo" className="h-7 w-auto object-contain" />
                <div className="text-center">
                  <div className="font-black text-xs text-[#0F172A] leading-tight">MATERIAL LOCATION / LOC</div>
                  <div className="text-[8px] text-[#475569] font-bold">MSG OILFIELD SUPPLIES</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-xs text-[#1E293B]">SL NO: {items[0]?.sl_no || 1}</div>
                  <div className="text-[8px] text-[#64748B]">REF #{String(items[0]?.sl_no || 1).padStart(4, '0')}</div>
                </div>
              </div>

              {/* LOC Box */}
              <div className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 text-center">
                <div className="text-[9px] font-bold text-[#475569] uppercase">LOCATION / LOC</div>
                <div className="text-lg font-black text-[#0F172A] font-mono leading-tight">
                  {items[0]?.loc || items[0]?.location || 'BB10'}
                </div>
              </div>

              {/* Data Specifications Table */}
              <div className="border border-[#E2E8F0] rounded-lg overflow-hidden text-[9px]">
                <div className="grid grid-cols-4 bg-[#F1F5F9] border-b border-[#E2E8F0] p-1.5">
                  <span className="font-bold text-[#334155]">Description:</span>
                  <span className="font-bold text-[#0F172A] col-span-1 truncate">{items[0]?.description || '-'}</span>
                  <span className="font-bold text-[#334155]">PO Number:</span>
                  <span className="font-bold text-[#0F172A] truncate">{items[0]?.po_number || '-'}</span>
                </div>
                <div className="grid grid-cols-4 bg-white border-b border-[#E2E8F0] p-1.5">
                  <span className="font-bold text-[#334155]">PO Qty &amp; UOM:</span>
                  <span className="text-[#0F172A]">{items[0]?.po_qty || 1} {items[0]?.uom || 'PCS'}</span>
                  <span className="font-bold text-[#334155]">MAKE:</span>
                  <span className="text-[#0F172A] truncate">{items[0]?.make || 'BENKAN'}</span>
                </div>
                <div className="grid grid-cols-4 bg-[#F8FAFC] border-b border-[#E2E8F0] p-1.5">
                  <span className="font-bold text-[#334155]">Heat Number:</span>
                  <span className="font-bold text-[#0F172A] font-mono">{items[0]?.heat_number || 'REQUIRED'}</span>
                  <span className="font-bold text-[#334155]">Certificate No:</span>
                  <span className="text-[#0F172A] font-mono truncate">{items[0]?.certificate_number || '-'}</span>
                </div>
                <div className="grid grid-cols-4 bg-white p-1.5">
                  <span className="font-bold text-[#334155]">Supplier:</span>
                  <span className="text-[#0F172A] truncate">{items[0]?.supplier || '-'}</span>
                  <span className="font-bold text-[#334155]">Remarks (1 &amp; 2):</span>
                  <span className="text-[#0F172A] truncate">{items[0]?.remarks || '-'}</span>
                </div>
              </div>

              {/* Signature Section */}
              <div className="pt-1.5 border-t border-[#CBD5E1] grid grid-cols-3 items-end text-[8px] text-[#334155] px-1">
                <div>
                  <div className="font-bold text-[#1E293B] mb-0.5">Authorized Signature</div>
                  <img src="/assets/signature.png" alt="Signature" className="h-5 w-auto object-contain" />
                </div>
                <div className="font-bold">Authorized By: ____________</div>
                <div className="font-bold text-right">Date: ____________</div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-[11px] text-slate-400">
                Print layout standard: 2 tags vertically on A4 with 14mm margins.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Line Items Table */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col h-full min-h-[460px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <span>Authoritative Line Items</span>
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                    {items.length} Items
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  These items will be formatted strictly onto material location stickers
                </p>
              </div>

              <button
                onClick={() => {
                  if (selectedOrderId) loadOrderItems(selectedOrderId, true)
                }}
                className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center space-x-1"
                title="Reload from Active Order"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <Tag className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-semibold text-sm text-slate-700">No Line Items Found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Upload an order in Sales Orders or select an alternate Excel sheet.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Pos #</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">PO Qty</th>
                      <th className="p-3">Heat Number</th>
                      <th className="p-3">MAKE</th>
                      <th className="p-3">LOC / Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-700">{it.sl_no}</td>
                        <td className="p-3 text-slate-900 font-semibold max-w-[220px] truncate" title={it.description}>
                          {it.description}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {it.po_qty} {it.uom}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-900 border border-slate-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded">
                            {it.heat_number}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{it.make}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-mono font-black px-2.5 py-0.5 rounded">
                            {it.loc || it.location || 'BB10'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
