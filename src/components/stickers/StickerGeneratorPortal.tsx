import React, { useState, useEffect } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  X,
  Sparkles,
  CheckCircle2,
  Type,
  Image as ImageIcon,
  QrCode,
  ArrowRight,
  FileCheck,
  ChevronDown,
  Layers,
  Tag,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { db } from '../../services/db'
import {
  StickerItem,
  StickerOptions,
  parseExcelForStickers,
  generateStickersPdf,
  downloadStickerPdfBlob,
} from '../../services/stickerEngine'

export const StickerGeneratorPortal: React.FC = () => {
  const [xlsxFile, setXlsxFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Items state
  const [items, setItems] = useState<StickerItem[]>([])
  const [sourceMode, setSourceMode] = useState<'excel' | 'order'>('excel')
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')

  // Customization Options Modal
  const [showOptions, setShowOptions] = useState(false)
  const [font, setFont] = useState<'Helvetica' | 'Times' | 'Courier'>('Helvetica')
  const [addLogo, setAddLogo] = useState(true)
  const [addQr, setAddQr] = useState(true)

  // Existing orders
  const existingOrders = db.getOrders()

  useEffect(() => {
    if (existingOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(existingOrders[0].id)
    }
  }, [existingOrders])

  // Handle Excel Upload
  const handleXlsxChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setXlsxFile(file)
    setErrorNotice(null)
    setSuccessNotice(null)
    setLoading(true)

    try {
      const parsed = await parseExcelForStickers(file)
      if (parsed.length === 0) {
        throw new Error('No valid material rows found in the selected Excel file.')
      }
      setItems(parsed)
      setSuccessNotice(`Successfully loaded ${parsed.length} line items from ${file.name}!`)
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to parse Excel file.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  // Load from existing Sales Order
  const handleLoadFromOrder = (orderId: string) => {
    setSelectedOrderId(orderId)
    const order = existingOrders.find(o => o.id === orderId)
    if (!order) return

    const orderItems: StickerItem[] = order.items.map((it, idx) => {
      const itAny = it as any
      const pos = itAny.position || idx + 1
      const heat = it.heat_number || itAny.heatNumber || 'REQUIRED'
      const loc = it.location || itAny.remarks || 'BB10 / RACK-01'
      return {
        sl_no: pos,
        client_po_item_no: itAny.client_po_item_no || `${pos}`,
        description: it.item_description || `${it.item_code} Oilfield Material`,
        po_qty: it.required_qty,
        uom: it.uom || 'PCS',
        heat_number: heat,
        certificate_number: heat !== 'REQUIRED' ? `MTC-${heat}.pdf` : '-',
        make: itAny.make || 'BENKAN THAILAND',
        remarks: itAny.remarks || '',
        location: loc,
        supplier: itAny.supplier_name || 'Stock Allocated',
        po_number: order.po_number,
      }
    })

    setItems(orderItems)
    setXlsxFile(null)
    setSuccessNotice(`Loaded ${orderItems.length} items from ${order.so_number} (${order.customer_name})!`)
  }

  // Handle Form Submit (open customization modal)
  const handleOpenCustomization = (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      setErrorNotice('Please select an Excel file or load a Sales Order first.')
      return
    }
    setErrorNotice(null)
    setShowOptions(true)
  }

  // Generate and Download PDF
  const handleConfirmGenerate = async () => {
    if (items.length === 0) return

    setLoading(true)
    setShowOptions(false)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const options: StickerOptions = { font, addLogo, addQr }
      const pdfBytes = await generateStickersPdf(items, options)
      downloadStickerPdfBlob(pdfBytes, 'stickers_msg_final.pdf')

      setSuccessNotice('Stickers generated successfully! Your download should start shortly.')
      setTimeout(() => setSuccessNotice(null), 6000)
    } catch (err: any) {
      console.error('Sticker Generation Error:', err)
      setErrorNotice(err.message || 'Failed to generate stickers PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>MSG-Sticker Portal</span>
              </span>
              <span className="text-slate-400 text-xs font-mono">Print-Ready 2-per-A4 PDF</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Material Sticker &amp; Location Tag Generator
            </h1>
            <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
              Transform your Excel inventory summaries, stores sheets, or active sales orders into official, publication-quality material identification stickers with custom typography, official MSG logo branding, and dynamic traceability QR codes.
            </p>
          </div>

          {/* Quick Stats Box */}
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex items-center space-x-4 shrink-0 shadow-inner">
            <div className="w-12 h-12 bg-indigo-600/30 border border-indigo-400/40 rounded-xl flex items-center justify-center text-indigo-300">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ready Stickers</div>
              <div className="text-2xl font-black text-white">{items.length}</div>
              <div className="text-[11px] text-emerald-400 font-medium">
                {items.length > 0 ? `${Math.ceil(items.length / 2)} Pages (2 / A4)` : 'Awaiting input'}
              </div>
            </div>
          </div>
        </div>

        {/* Notices */}
        {successNotice && (
          <div className="mt-4 p-3.5 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {errorNotice && (
          <div className="mt-4 p-3.5 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center space-x-2 animate-fade-in">
            <X className="h-4 w-4 text-red-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}
      </div>

      {/* Main Configuration Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Source Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            {/* Source Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => setSourceMode('excel')}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  sourceMode === 'excel'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Upload Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSourceMode('order')
                  if (selectedOrderId) handleLoadFromOrder(selectedOrderId)
                }}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                  sourceMode === 'order'
                    ? 'bg-white text-indigo-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Active Sales Order</span>
              </button>
            </div>

            {sourceMode === 'excel' ? (
              <form onSubmit={handleOpenCustomization} className="space-y-4">
                <label className="group flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/40 transition-all duration-300 relative overflow-hidden text-center">
                  <div className="relative z-10 flex flex-col items-center">
                    {xlsxFile ? (
                      <>
                        <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-md">
                          <FileCheck className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-slate-900 font-bold text-sm mb-0.5 max-w-[240px] truncate">{xlsxFile.name}</p>
                        <p className="text-slate-500 text-xs">{(xlsxFile.size / 1024).toFixed(1)} KB • Click to replace</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition-transform duration-200">
                          <Upload className="w-7 h-7 text-white" />
                        </div>
                        <p className="text-slate-800 font-bold text-sm mb-1">Drop your Excel file here</p>
                        <p className="text-slate-500 text-xs">or click to browse from device</p>
                        <span className="mt-2 text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                          .xlsx supported
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleXlsxChange}
                    className="hidden"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Stickers ({items.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Select Authoritative Sales Order
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={e => handleLoadFromOrder(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {existingOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.so_number} - {o.customer_name} ({o.items.length} items)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
                  <span className="font-bold">Sync Active:</span> Line items are loaded directly from the selected Sales Order in exact position sequence without duplicates.
                </div>

                <button
                  onClick={handleOpenCustomization}
                  disabled={items.length === 0}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
                >
                  <span>Customize &amp; Export Stickers ({items.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Sample Preview Card */}
          {items.length > 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>Sticker Live Preview</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">Sample Item #1</span>
              </div>

              {/* Sample Sticker Wireframe */}
              <div className="border-2 border-slate-800 rounded-2xl overflow-hidden bg-white text-[11px] shadow-sm">
                <div className="bg-slate-900 text-white p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src="/logo.png" alt="MSG" className="h-6 w-auto object-contain bg-white/10 rounded px-1" />
                    <div>
                      <div className="font-black text-xs leading-none">MSG OILFIELD EQUIPMENT TRADING LLC</div>
                      <div className="text-[8px] text-amber-400 font-semibold mt-0.5">MATERIAL IDENTIFICATION TAG</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex justify-between font-mono font-bold text-[10px] text-slate-600 border-b border-slate-100 pb-1">
                    <span>POS #: {items[0]?.sl_no}</span>
                    <span>QTY: {items[0]?.po_qty} {items[0]?.uom}</span>
                  </div>

                  <div className="font-bold text-slate-900 text-xs line-clamp-2">
                    {items[0]?.description}
                  </div>

                  <div className="p-2 bg-red-50 border border-red-300 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-bold text-red-600 uppercase">HEAT NUMBER</div>
                      <div className="text-xs font-black text-red-700 font-mono">{items[0]?.heat_number || 'REQUIRED'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold text-slate-500 uppercase">MTC REF</div>
                      <div className="text-[10px] font-bold text-slate-800 font-mono truncate max-w-[100px]">
                        {items[0]?.certificate_number || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-bold text-amber-700 uppercase">LOCATION / REMARKS</div>
                      <div className="text-xs font-bold text-amber-900 font-mono">{items[0]?.location || items[0]?.remarks || 'BB10'}</div>
                    </div>
                    <div className="text-right text-[10px] font-bold text-slate-700">
                      {items[0]?.make}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Parsed Items Table */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col h-full min-h-[480px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>Line Items Ready for Stickers</span>
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify heat numbers and location tags before printing
                </p>
              </div>

              {items.length > 0 && (
                <button
                  onClick={() => setItems([])}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                <Tag className="w-12 h-12 text-slate-300 mb-3" />
                <p className="font-semibold text-sm text-slate-600">No Line Items Loaded</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Upload an Excel inventory sheet (.xlsx) or load directly from an Active Sales Order to generate stickers.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Heat No</th>
                      <th className="p-3">Make</th>
                      <th className="p-3">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-600">{it.sl_no}</td>
                        <td className="p-3 text-slate-900 font-semibold max-w-[200px] truncate" title={it.description}>
                          {it.description}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {it.po_qty} {it.uom}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                            {it.heat_number || 'REQUIRED'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{it.make}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                            {it.location || it.remarks || 'BB10'}
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

      {/* Modern Customization Modal (from MSG-Sticker-Frontend) */}
      {showOptions && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowOptions(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-8 w-full max-w-md relative"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowOptions(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Customize Your Stickers</h2>
              <p className="text-gray-600 text-xs">
                Generating stickers for {items.length} items (2 stickers per A4 page)
              </p>
            </div>

            {/* Form Options */}
            <div className="space-y-5">
              {/* Font Selection */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  Font Family
                </label>
                <div className="relative">
                  <select
                    value={font}
                    onChange={e => setFont(e.target.value as any)}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm text-gray-700 bg-white hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="Helvetica">Helvetica (Standard Clean)</option>
                    <option value="Times">Times (Formal Serif)</option>
                    <option value="Courier">Courier (Technical Monospace)</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Logo Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 rounded-xl border border-gray-200 hover:border-indigo-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <label htmlFor="addLogo" className="font-semibold text-gray-800 text-xs cursor-pointer">
                      Include Company Logo
                    </label>
                    <p className="text-[11px] text-gray-500">Official MSG Oilfield banner branding</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="addLogo"
                    checked={addLogo}
                    onChange={e => setAddLogo(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600"></div>
                </label>
              </div>

              {/* QR Code Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-purple-50/50 rounded-xl border border-gray-200 hover:border-purple-300 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-sm">
                    <QrCode className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <label htmlFor="addQr" className="font-semibold text-gray-800 text-xs cursor-pointer">
                      Include QR Code
                    </label>
                    <p className="text-[11px] text-gray-500">Fast barcode scan for MTC &amp; heat traceability</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="addQr"
                    checked={addQr}
                    onChange={e => setAddQr(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowOptions(false)}
                className="px-5 py-2 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGenerate}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center space-x-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering PDF...</span>
                  </>
                ) : (
                  <>
                    <span>Generate &amp; Download PDF</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
