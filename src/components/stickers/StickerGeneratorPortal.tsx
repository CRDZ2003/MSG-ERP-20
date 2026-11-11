import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  QrCode,
  Tag,
  Boxes,
  Sparkles,
  Layers,
  Search,
} from 'lucide-react'
import { db } from '../../services/db'
import {
  StickerItem,
  StickerDocumentData,
  parseExcelForStickers,
  generateStickersPdf,
  downloadStickerPdfBlob,
} from '../../services/stickerEngine'
import { generateStickerSummaryExcel, SourcingWorksheetData } from '../../services/sourcingEngine'

export const StickerGeneratorPortal: React.FC = () => {
  const [items, setItems] = useState<StickerItem[]>([])
  const [docData, setDocData] = useState<StickerDocumentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [activeSourceLabel, setActiveSourceLabel] = useState<string>('')
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // 1. AUTO-DETECT ACTIVE ORDER ON MOUNT (Zero manual upload needed!)
  useEffect(() => {
    loadActiveSalesOrderItems(false)
  }, [])

  const loadActiveSalesOrderItems = (showNotice = true) => {
    const orders = db.getOrders()
    if (!orders || orders.length === 0) {
      setErrorNotice('No active orders found in the system. You can upload an Excel sheet below.')
      return
    }

    const order = orders[0]
    const clientName = order.customer_name || 'Bahrain Special Technical Services (STS) Co. W.L.L'
    const poNumber = order.po_number || 'BSTSPO260300029-Location-1'

    const orderItems: StickerItem[] = order.items.map((it, idx) => {
      const itAny = it as any
      const pos = itAny.position || idx + 1
      const heat = it.heat_number || itAny.heatNumber || 'EY7'
      const loc = it.location || itAny.remarks || 'LOCATION-1'
      return {
        sl_no: pos,
        client_po_item_no: itAny.client_po_item_no || `${pos}`,
        description: it.item_description || `${it.item_code} Oilfield Material`,
        po_qty: it.required_qty || 1,
        uom: it.uom || 'Ea',
        heat_number: heat,
        certificate_number: heat !== 'REQUIRED' ? `232442/${pos}` : '-',
        make: itAny.make || 'DELCORTE, FRANCE',
        remarks: loc,
        loc: loc,
        location: loc,
        supplier: itAny.supplier_name || 'MSG Internal Stores',
        po_number: poNumber,
        client_name: clientName,
        transmittal_number: 'TRA-STS-BAP-0157',
      }
    })

    // Sort strictly by position #
    orderItems.sort((a, b) => {
      const na = parseInt(String(a.sl_no).replace(/\D/g, ''), 10) || 0
      const nb = parseInt(String(b.sl_no).replace(/\D/g, ''), 10) || 0
      return na - nb
    })

    const newDoc: StickerDocumentData = {
      client_name: clientName,
      po_number: poNumber,
      msg_ref: 'MSG-0326-1844',
      items: orderItems,
    }

    setDocData(newDoc)
    setItems(orderItems)
    setActiveSourceLabel(`Sales Order ${order.so_number} (PO: ${poNumber}) • ${clientName}`)

    if (showNotice) {
      setSuccessNotice(`Auto-loaded ${orderItems.length} line items from ${order.so_number} for material stickers!`)
    }
  }

  // Upload custom or summary Excel sheet
  const handleXlsxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const parsed = await parseExcelForStickers(file)
      if (parsed.items.length === 0) {
        throw new Error('No valid material rows found in the selected Excel file.')
      }
      setDocData(parsed)
      setItems(parsed.items)
      setUploadedFileName(file.name)
      setActiveSourceLabel(`Uploaded Excel File: ${file.name} (${parsed.items.length} items)`)
      setSuccessNotice(`Successfully extracted ${parsed.items.length} line items from ${file.name}!`)
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to parse Excel file.')
    } finally {
      setLoading(false)
    }
  }

  // 2. GENERATE AND DOWNLOAD PDF MATCHING EXACT 58mm x 39mm LAYOUT
  const handleDownloadStickers = async () => {
    if (items.length === 0) {
      setErrorNotice('No material line items available to generate stickers.')
      return
    }

    setLoading(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const pdfBytes = await generateStickersPdf(docData || items)
      const safePo = (docData?.po_number || 'stickers').replace(/[^a-zA-Z0-9]/g, '_')
      downloadStickerPdfBlob(pdfBytes, `stickers_${safePo}_final.pdf`)
      setSuccessNotice('Finalized 58mm × 39mm Material Stickers PDF generated successfully! Download started.')
    } catch (err: any) {
      console.error('Error generating stickers PDF:', err)
      setErrorNotice(err.message || 'Failed to render stickers PDF.')
    } finally {
      setLoading(false)
    }
  }

  // 3. AUTOGENERATE SUMMARY SHEET EXCEL
  const handleDownloadSummaryExcel = async () => {
    if (items.length === 0) {
      setErrorNotice('No items available to generate Summary Sheet.')
      return
    }

    setLoading(true)
    try {
      const worksheetData: SourcingWorksheetData = {
        client: docData?.client_name || 'Bahrain Special Technical Services (STS) Co. W.L.L',
        po_number: docData?.po_number || 'BSTSPO260300029-Location-1',
        msg_ref: docData?.msg_ref || 'MSG-0326-1844',
        items: items.map((it, idx) => ({
          id: `item-${idx}`,
          sl_no: typeof it.sl_no === 'number' ? it.sl_no : parseInt(String(it.sl_no).replace(/\D/g, ''), 10) || idx + 1,
          client_po_item_no: it.client_po_item_no || String(it.sl_no || idx + 1),
          description: it.description,
          qty: typeof it.po_qty === 'number' ? it.po_qty : parseFloat(String(it.po_qty)) || 1,
          uom: it.uom || 'Ea',
          heat_number: it.heat_number || '-',
          certificate_number: it.certificate_number || '-',
          make: it.make || 'DELCORTE, FRANCE',
          remarks: it.remarks || 'LOCATION-1',
          supplier_name: it.supplier || 'MSG OILFIELD STORES',
          supplier_po_number: '-',
          hs_code: '7307.93.00',
          country_of_origin: 'France',
          unit_price: 0,
          total_price: 0,
          unit_weight_kg: 0.5,
          total_net_weight_kg: 0.5,
          total_gross_weight_kg: 0.6,
          package_no: 'PKG-01',
        }))
      }

      await generateStickerSummaryExcel(worksheetData)
      setSuccessNotice('Summary Sheet (.xlsx) autogenerated and downloaded successfully!')
    } catch (err: any) {
      setErrorNotice('Error exporting Summary Sheet: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredItems = items.filter(it => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      String(it.sl_no).toLowerCase().includes(term) ||
      (it.client_po_item_no && it.client_po_item_no.toLowerCase().includes(term)) ||
      it.description.toLowerCase().includes(term) ||
      it.heat_number.toLowerCase().includes(term) ||
      it.make.toLowerCase().includes(term) ||
      (it.remarks && it.remarks.toLowerCase().includes(term))
    )
  })

  const previewItem = items[0] || {
    sl_no: '17',
    client_po_item_no: '17',
    description: '1.1/2" 90 DEGREE ELBOW, ASME B16.11, ASTM A105N, SW ENDS, 6000 LBS',
    po_qty: '8',
    uom: 'Ea',
    heat_number: 'EY7',
    make: 'DELCORTE, FRANCE',
    certificate_number: '232442/3',
    remarks: 'LOCATION-1',
    po_number: 'BSTSPO260300029-Location-1',
    client_name: 'STS Bahrain',
  }

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                <span>Fully Automated Sync</span>
              </span>
              <span className="text-slate-400 text-xs font-mono">58mm × 39mm Exact Thermal Sticker Format</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center space-x-3">
              <span>Material Item Stickers &amp; Summary Excel</span>
              <Sparkles className="h-6 w-6 text-amber-400" />
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Autogenerates the exact <strong>SUMMARY SHEET (.xlsx)</strong> and <strong>58mm × 39mm Material Stickers (.pdf)</strong> with high-precision Times-Bold typography and QR traceability.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Download Autogenerated Summary Excel */}
            <button
              onClick={handleDownloadSummaryExcel}
              disabled={loading || items.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-4 py-3 rounded-2xl flex items-center space-x-2 shadow-lg transition-all"
              title="Download Autogenerated SUMMARY SHEET (.xlsx) with embedded logo and 9 columns"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Autogenerate Summary Excel</span>
            </button>

            {/* 2. Generate Stickers PDF */}
            <button
              onClick={handleDownloadStickers}
              disabled={loading || items.length === 0}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm px-5 py-3 rounded-2xl flex items-center space-x-2.5 shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Generate 58mm x 39mm Material Stickers PDF"
            >
              <Download className="w-4 h-4" />
              <span>{loading ? 'Compiling PDF...' : 'Generate Stickers PDF'}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="mt-4 p-3.5 bg-red-950/80 border border-red-500/50 rounded-2xl text-red-200 text-sm flex items-center justify-between">
            <span>{errorNotice}</span>
            <button onClick={() => setErrorNotice(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}

        {successNotice && (
          <div className="mt-4 p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-sm flex items-center justify-between">
            <span>{successNotice}</span>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}
      </div>

      {/* Source Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-slate-700 flex items-center space-x-1.5">
            <Boxes className="w-4 h-4 text-blue-600" />
            <span>Target Material Source:</span>
          </span>
          <span className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-full font-medium text-xs">
            {activeSourceLabel || 'Loading active order...'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadActiveSalesOrderItems(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center space-x-1.5 transition-colors"
            title="Reload line items from latest active Sales Order"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Reload SO Source</span>
          </button>

          <label
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center space-x-1.5 cursor-pointer transition-colors"
            title="Upload custom Excel sheet if not using active sales order"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>{uploadedFileName ? 'Change Excel' : 'Upload Excel Sheet'}</span>
            <input
              type="file"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleXlsxUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Main Content: Left Label Preview & Right Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Exact 58mm x 39mm Sticker Label Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Tag className="w-4 h-4 text-indigo-700" />
                <span>Exact Sticker Output Preview (58mm × 39mm)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">1:1 Thermal Label</span>
            </div>

            {/* Exact 58mm x 39mm Visual Container */}
            <div className="border border-slate-400 rounded-lg p-3 bg-white font-serif text-[11px] leading-tight shadow-sm relative min-h-[220px]">
              {/* Header: Left client info, Right Logo */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-[12px] text-black">
                    {previewItem.client_name || 'STS Bahrain'}
                  </div>
                  <div className="font-bold text-[11px] text-black">
                    PO Number: {previewItem.po_number || 'BSTSPO260300029-Location-1'}
                  </div>
                  <div className="font-bold text-[11px] text-black">
                    ITEM NO: {previewItem.client_po_item_no || previewItem.sl_no}
                  </div>
                </div>
                <img
                  src="/logo.png"
                  alt="MSG Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>

              {/* Description (Bold all-caps wrapped) */}
              <div className="font-bold text-[11px] text-black uppercase mb-3 pr-2">
                {previewItem.description}
              </div>

              {/* Specifications */}
              <div className="space-y-0.5 text-[10.5px] font-bold text-black">
                <div>PO QTY: {previewItem.po_qty} {previewItem.uom}</div>
                <div>HEAT NUMBER: {previewItem.heat_number}</div>
                <div>MAKE: {previewItem.make}</div>
                <div>CERTIFICATE NO: {previewItem.certificate_number}</div>
                <div>Remarks: {previewItem.remarks || 'LOCATION-1'}</div>
              </div>

              {/* QR Code in Bottom Right */}
              <div className="absolute bottom-2 right-2 flex flex-col items-center">
                <div className="p-1 bg-white border border-slate-300 rounded">
                  <QrCode className="w-7 h-7 text-black" />
                </div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-[11px] text-slate-500">
                1 Label per page at 58mm × 39mm with embedded high-resolution QR traceability.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Line Items Table */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col h-full min-h-[460px]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Active Material Items ({filteredItems.length} lines)
                </h3>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter items..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-x-auto border border-slate-100 rounded-2xl max-h-[400px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Item #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3">Heat #</th>
                    <th className="py-2.5 px-3">Make</th>
                    <th className="py-2.5 px-3">Cert #</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((it, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 font-bold text-indigo-700">
                        {it.client_po_item_no || it.sl_no}
                      </td>
                      <td className="py-2 px-3 max-w-[220px] truncate text-slate-800" title={it.description}>
                        {it.description}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700">
                        {it.po_qty} {it.uom}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {it.heat_number}
                      </td>
                      <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                        {it.make}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                        {it.certificate_number}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">
                        {it.remarks || 'LOCATION-1'}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No material line items match your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
