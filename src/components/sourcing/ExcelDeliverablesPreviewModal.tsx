import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Layers,
  FileText,
  Truck,
  Package,
  X,
  Download,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import {
  SourcingWorksheetData,
  SourcingLineItem,
  generateClientSummaryExcel,
  generateStoresSummaryExcel,
  generateStickerSummaryExcel,
  generateCIPLLogisticExcel,
} from '../../services/sourcingEngine'

export type SourcingPreviewTab = 'summary' | 'stores' | 'client' | 'cipl_invoice' | 'cipl_packing'

interface ExcelDeliverablesPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: SourcingPreviewTab
  data: SourcingWorksheetData
  filterMachinedOnly?: boolean
}

export const ExcelDeliverablesPreviewModal: React.FC<ExcelDeliverablesPreviewModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'client',
  data,
  filterMachinedOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<SourcingPreviewTab>(initialTab)
  const [isExporting, setIsExporting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab, isOpen])

  if (!isOpen) return null

  const items = filterMachinedOnly ? data.items.filter(it => it.is_machined) : data.items

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  // Download Handlers
  const handleDownloadSummary = async () => {
    setIsExporting(true)
    try {
      await generateStickerSummaryExcel(data)
      showToast('Summary Sheet (.xlsx) downloaded successfully!')
    } catch (err: any) {
      alert('Error exporting Summary Sheet: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadStores = async () => {
    setIsExporting(true)
    try {
      await generateStoresSummaryExcel(data, filterMachinedOnly)
      showToast('Stores Summary Sheet (.xlsx) downloaded successfully!')
    } catch (err: any) {
      alert('Error exporting Stores Summary: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadClient = async () => {
    setIsExporting(true)
    try {
      await generateClientSummaryExcel(data, filterMachinedOnly)
      showToast('Client Summary Sheet (.xlsx) downloaded successfully!')
    } catch (err: any) {
      alert('Error exporting Client Summary: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadCIPL = async () => {
    setIsExporting(true)
    try {
      await generateCIPLLogisticExcel(data)
      showToast('CIPL Logistics Workbook (.xlsx) downloaded successfully!')
    } catch (err: any) {
      alert('Error exporting CIPL: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-2 sm:p-4 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Modal Top Header with Sheet Tabs */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-wide text-white">Excel Deliverable Preview &amp; Download</span>
                <span className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {items.length} items
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Visual worksheet preview before downloading. Switch tabs to inspect all 4 Excel deliverables.
              </p>
            </div>
          </div>

          {/* Interactive Sheet Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('client')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'client'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Client Summary</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stores')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'stores'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Stores Summary (11 Cols)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'summary'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Sticker Summary (8 Cols)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cipl_invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'cipl_invoice'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>CIPL Commercial Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cipl_packing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'cipl_packing'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>CIPL Packing List</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors ml-1 cursor-pointer"
              title="Close Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Toast Banner */}
        {toastMsg && (
          <div className="bg-emerald-600 text-white px-5 py-2 text-xs font-bold flex items-center space-x-2 animate-in slide-in-from-top-1 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Preview Sheet Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 text-xs font-sans">
          <div className="bg-white border-2 border-slate-300 rounded-xl shadow-md p-5 sm:p-7 max-w-5xl mx-auto space-y-4">
            
            {/* TAB 1: CLIENT SUMMARY SHEET (9 COLUMNS) */}
            {activeTab === 'client' && (
              <div className="space-y-4">
                <div className="text-center font-bold text-base tracking-wider border-b-2 border-emerald-500 pb-2 text-emerald-950 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">FORMAT: CLIENT SUMMARY SHEET</span>
                  <span className="font-extrabold uppercase text-slate-900">MSG OILFIELD - CLIENT SUMMARY SHEET</span>
                  <span className="text-xs font-mono font-bold text-emerald-700">9 COLUMNS</span>
                </div>

                <div className="grid grid-cols-3 border border-slate-300 text-xs">
                  <div className="col-span-2 p-3 space-y-1 font-bold border-r border-slate-300 text-slate-800">
                    <div>Client : {data.client || 'Customer'}</div>
                    <div>PO Number: {data.po_number || '-'}</div>
                    <div>MSG Ref:   {data.msg_ref || '-'}</div>
                  </div>
                  <div className="p-3 flex items-center justify-center bg-emerald-50/50">
                    <div className="text-center font-bold font-mono text-emerald-700 tracking-wide text-xs">
                      [ CLIENT OFFICIAL PUBLICATION ]
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-emerald-100 font-bold border-b border-emerald-200 text-emerald-950 text-center">
                        <th className="p-2 border-r border-emerald-200 w-12">SL NO</th>
                        <th className="p-2 border-r border-emerald-200 w-24">CLIENT PO ITEM NO</th>
                        <th className="p-2 border-r border-emerald-200 text-left min-w-[240px]">Description</th>
                        <th className="p-2 border-r border-emerald-200 w-16">PO Qty</th>
                        <th className="p-2 border-r border-emerald-200 w-12">UOM</th>
                        <th className="p-2 border-r border-emerald-200 w-24">Heat Number</th>
                        <th className="p-2 border-r border-emerald-200 w-24">Certificate #</th>
                        <th className="p-2 border-r border-emerald-200 w-28">MAKE</th>
                        <th className="p-2 w-28">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-emerald-50/30">
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.sl_no || idx + 1}</td>
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.client_po_item_no || idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-sans">{it.description}</td>
                          <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.uom}</td>
                          <td className="p-2 text-center font-mono font-bold text-red-700 border-r border-slate-200">{it.heat_number || '-'}</td>
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.certificate_number || '-'}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.make || '-'}</td>
                          <td className="p-2 text-center text-slate-700">{it.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: STORES SHEET (11 COLUMNS WITH SUPPLIER DETAILS) */}
            {activeTab === 'stores' && (
              <div className="space-y-4">
                <div className="text-center font-bold text-base tracking-wider border-b-2 border-blue-500 pb-2 text-blue-950 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">FORMAT: STORES INTERNAL SHEET</span>
                  <span className="font-extrabold uppercase text-slate-900">MSG OILFIELD - STORES SUMMARY SHEET (WITH SUPPLIERS)</span>
                  <span className="text-xs font-mono font-bold text-blue-700">11 COLUMNS</span>
                </div>

                <div className="grid grid-cols-3 border border-slate-300 text-xs">
                  <div className="col-span-2 p-3 space-y-1 font-bold border-r border-slate-300 text-slate-800">
                    <div>Client : {data.client || 'Customer'}</div>
                    <div>PO Number: {data.po_number || '-'}</div>
                    <div>MSG Ref:   {data.msg_ref || '-'}</div>
                  </div>
                  <div className="p-3 flex items-center justify-center bg-blue-50/50">
                    <div className="text-center font-bold font-mono text-blue-700 tracking-wide text-xs">
                      [ STORES INTERNAL PROCUREMENT VIEW ]
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-blue-100 font-bold border-b border-blue-200 text-blue-950 text-center">
                        <th className="p-2 border-r border-blue-200 w-12">SL NO</th>
                        <th className="p-2 border-r border-blue-200 w-20">CLIENT PO ITEM NO</th>
                        <th className="p-2 border-r border-blue-200 text-left min-w-[200px]">Description</th>
                        <th className="p-2 border-r border-blue-200 w-16">PO Qty</th>
                        <th className="p-2 border-r border-blue-200 w-12">UOM</th>
                        <th className="p-2 border-r border-blue-200 w-24">Heat Number</th>
                        <th className="p-2 border-r border-blue-200 w-24">Certificate #</th>
                        <th className="p-2 border-r border-blue-200 w-28">MAKE</th>
                        <th className="p-2 border-r border-blue-200 w-24">Remarks</th>
                        <th className="p-2 border-r border-blue-300 bg-blue-200 text-blue-900 w-28">SUPPLIER NAME</th>
                        <th className="p-2 bg-blue-200 text-blue-900 w-24">SUPPLIER PO #</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/30">
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.sl_no || idx + 1}</td>
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.client_po_item_no || idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-sans">{it.description}</td>
                          <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.uom}</td>
                          <td className="p-2 text-center font-mono font-bold text-red-700 border-r border-slate-200">{it.heat_number || '-'}</td>
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.certificate_number || '-'}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.make || '-'}</td>
                          <td className="p-2 text-center border-r border-slate-200 text-slate-700">{it.remarks || '-'}</td>
                          <td className="p-2 text-center font-semibold text-blue-800 bg-blue-50/50 border-r border-slate-200">
                            {it.supplier_name || 'DELCORTE SAS'}
                          </td>
                          <td className="p-2 text-center font-mono text-blue-900 bg-blue-50/50">
                            {it.supplier_po_number || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: STICKER SUMMARY SHEET (8 COLUMNS) */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <div className="text-center font-bold text-base tracking-wider border-b-2 border-teal-500 pb-2 text-teal-950 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">FORMAT: SUMMARY SHEET</span>
                  <span className="font-extrabold uppercase text-slate-900">SUMMARY SHEET (STICKER SOURCE)</span>
                  <span className="text-xs font-mono font-bold text-teal-700">8 COLUMNS</span>
                </div>

                <div className="grid grid-cols-3 border border-slate-300 text-xs">
                  <div className="col-span-2 p-3 space-y-1 font-bold border-r border-slate-300 text-slate-800">
                    <div>Client : {data.client || 'Customer'}</div>
                    <div>PO Number: {data.po_number || '-'}</div>
                    <div>MSG Ref:   {data.msg_ref || '-'}</div>
                  </div>
                  <div className="p-3 flex items-center justify-center bg-teal-50/50">
                    <div className="text-center font-bold font-mono text-teal-700 tracking-wide text-xs">
                      [ MSG OILFIELD LOGO ]
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-teal-100 font-bold border-b border-teal-200 text-teal-950 text-center">
                        <th className="p-2 border-r border-teal-200">Item.CF.Client PO Item No</th>
                        <th className="p-2 border-r border-teal-200 text-left min-w-[240px]">Item Desc</th>
                        <th className="p-2 border-r border-teal-200 w-16">QuantityOrdered</th>
                        <th className="p-2 border-r border-teal-200 w-12">Unit</th>
                        <th className="p-2 border-r border-teal-200 w-24">Heat Number</th>
                        <th className="p-2 border-r border-teal-200 w-28">Make</th>
                        <th className="p-2 border-r border-teal-200 w-24">Certificate Number</th>
                        <th className="p-2 w-28">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-teal-50/30">
                          <td className="p-2 text-center font-mono border-r border-slate-200 font-semibold">{it.client_po_item_no || idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-sans">{it.description}</td>
                          <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.uom}</td>
                          <td className="p-2 text-center font-mono font-bold text-red-700 border-r border-slate-200">{it.heat_number || '-'}</td>
                          <td className="p-2 text-center border-r border-slate-200">{it.make || '-'}</td>
                          <td className="p-2 text-center font-mono border-r border-slate-200">{it.certificate_number || '-'}</td>
                          <td className="p-2 text-center text-slate-700">{it.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: CIPL COMMERCIAL INVOICE */}
            {activeTab === 'cipl_invoice' && (() => {
              const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0)
              const totalAmt = items.reduce((sum, it) => sum + (it.qty || 1) * (it.unit_price || 50), 0)
              return (
                <div className="space-y-4">
                  <div className="text-center space-y-0.5 border-b-2 border-purple-600 pb-3">
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-wide uppercase">
                      MSG OILFIELD EQUIPMENT TRADING LLC
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      P.O. BOX 12345, JEBEL ALI FREE ZONE (JAFZA), DUBAI, UAE
                    </p>
                    <div className="inline-block mt-1 font-bold text-xs uppercase px-3 py-0.5 rounded bg-purple-100 text-purple-900">
                      COMMERCIAL INVOICE
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg text-[11px] bg-slate-50/50">
                    <div className="space-y-1">
                      <div><strong className="text-slate-600">INVOICE NO:</strong> <span className="font-mono font-bold text-purple-900">INV-{(data.msg_ref || 'MSG-2026').replace(/[^0-9]/g, '') || '2227'}</span></div>
                      <div><strong className="text-slate-600">INVOICE DATE:</strong> <span className="font-mono">{new Date().toISOString().substring(0, 10)}</span></div>
                      <div><strong className="text-slate-600">CLIENT PO NO:</strong> <span className="font-mono font-bold">{data.po_number || '-'}</span></div>
                      <div><strong className="text-slate-600">CURRENCY:</strong> <span className="font-bold">{data.currency || 'AED'}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div><strong className="text-slate-600">BUYER / CONSIGNEE:</strong> <span className="font-bold">{data.client || 'Customer'}</span></div>
                      <div><strong className="text-slate-600">PORT OF LOADING:</strong> Jebel Ali Port, UAE</div>
                      <div><strong className="text-slate-600">PORT OF DISCHARGE:</strong> {data.port_of_discharge || 'Bahrain'}</div>
                      <div><strong className="text-slate-600">TERMS:</strong> {data.payment_terms || '100% Against Shipping Documents'}</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-purple-100 font-bold border-b border-purple-200 text-purple-950 text-center">
                          <th className="p-2 border-r border-purple-200 w-12">ITEM</th>
                          <th className="p-2 border-r border-purple-200 text-left min-w-[240px]">DESCRIPTION OF GOODS</th>
                          <th className="p-2 border-r border-purple-200 w-24">HS CODE</th>
                          <th className="p-2 border-r border-purple-200 w-20">COO</th>
                          <th className="p-2 border-r border-purple-200 w-16">QTY</th>
                          <th className="p-2 border-r border-purple-200 w-14">UOM</th>
                          <th className="p-2 border-r border-purple-200 w-20">RATE ({data.currency || 'AED'})</th>
                          <th className="p-2 w-24">AMOUNT ({data.currency || 'AED'})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-purple-50/20">
                            <td className="p-2 text-center font-mono border-r border-slate-200">{it.client_po_item_no || idx + 1}</td>
                            <td className="p-2 border-r border-slate-200 text-left font-sans">{it.description}</td>
                            <td className="p-2 text-center font-mono border-r border-slate-200">{it.hs_code || '7307.93.00'}</td>
                            <td className="p-2 text-center border-r border-slate-200">{it.country_of_origin || 'Thailand'}</td>
                            <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                            <td className="p-2 text-center border-r border-slate-200">{it.uom}</td>
                            <td className="p-2 text-right font-mono border-r border-slate-200">{(it.unit_price || 50).toFixed(2)}</td>
                            <td className="p-2 text-right font-mono font-bold text-purple-900">{((it.qty || 1) * (it.unit_price || 50)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 font-bold border-t-2 border-purple-300">
                          <td colSpan={4} className="p-2 text-right uppercase text-purple-950">TOTAL INVOICE VALUE:</td>
                          <td className="p-2 text-center font-bold">{totalQty}</td>
                          <td colSpan={2}></td>
                          <td className="p-2 text-right font-mono text-purple-950 font-extrabold text-xs">
                            {data.currency || 'AED'} {totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* TAB 5: CIPL PACKING LIST */}
            {activeTab === 'cipl_packing' && (() => {
              const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0)
              const totalNet = items.reduce((sum, it) => sum + (it.total_net_weight_kg || 10), 0)
              const totalGross = items.reduce((sum, it) => sum + (it.total_gross_weight_kg || 12), 0)
              return (
                <div className="space-y-4">
                  <div className="text-center space-y-0.5 border-b-2 border-indigo-600 pb-3">
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-wide uppercase">
                      MSG OILFIELD EQUIPMENT TRADING LLC
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">
                      P.O. BOX 12345, JEBEL ALI FREE ZONE (JAFZA), DUBAI, UAE
                    </p>
                    <div className="inline-block mt-1 font-bold text-xs uppercase px-3 py-0.5 rounded bg-indigo-100 text-indigo-900">
                      PACKING LIST (CIPL)
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg text-[11px] bg-slate-50/50">
                    <div className="space-y-1">
                      <div><strong className="text-slate-600">PACKING LIST NO:</strong> <span className="font-mono font-bold text-indigo-900">PL-{(data.msg_ref || 'MSG-2026').replace(/[^0-9]/g, '') || '2227'}</span></div>
                      <div><strong className="text-slate-600">DATE:</strong> <span className="font-mono">{new Date().toISOString().substring(0, 10)}</span></div>
                      <div><strong className="text-slate-600">CLIENT PO NO:</strong> <span className="font-mono font-bold">{data.po_number || '-'}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div><strong className="text-slate-600">CONSIGNEE:</strong> <span className="font-bold">{data.client || 'Customer'}</span></div>
                      <div><strong className="text-slate-600">PORT OF DISCHARGE:</strong> {data.port_of_discharge || 'Bahrain'}</div>
                      <div><strong className="text-slate-600">TOTAL PACKAGES:</strong> <span className="font-bold font-mono">1 Pallet / Crate</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-indigo-100 font-bold border-b border-indigo-200 text-indigo-950 text-center">
                          <th className="p-2 border-r border-indigo-200 w-14">PKG #</th>
                          <th className="p-2 border-r border-indigo-200 text-left min-w-[240px]">DESCRIPTION OF GOODS</th>
                          <th className="p-2 border-r border-indigo-200 w-16">QTY</th>
                          <th className="p-2 border-r border-indigo-200 w-14">UOM</th>
                          <th className="p-2 border-r border-indigo-200 w-24">HEAT #</th>
                          <th className="p-2 border-r border-indigo-200 w-24">NET WT (KG)</th>
                          <th className="p-2 w-24">GROSS WT (KG)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/20">
                            <td className="p-2 text-center font-mono font-semibold border-r border-slate-200">{it.package_no || `PKG # 01`}</td>
                            <td className="p-2 border-r border-slate-200 text-left font-sans">{it.description}</td>
                            <td className="p-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                            <td className="p-2 text-center border-r border-slate-200">{it.uom}</td>
                            <td className="p-2 text-center font-mono font-bold text-red-700 border-r border-slate-200">{it.heat_number || '-'}</td>
                            <td className="p-2 text-right font-mono border-r border-slate-200">{(it.total_net_weight_kg || 10).toFixed(2)}</td>
                            <td className="p-2 text-right font-mono border-r border-slate-200">{(it.total_gross_weight_kg || 12).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-300">
                          <td colSpan={2} className="p-2 text-right uppercase text-indigo-950">TOTALS:</td>
                          <td className="p-2 text-center font-bold">{totalQty}</td>
                          <td colSpan={2}></td>
                          <td className="p-2 text-right font-mono text-indigo-950 font-extrabold">{totalNet.toFixed(2)} KG</td>
                          <td className="p-2 text-right font-mono text-indigo-950 font-extrabold">{totalGross.toFixed(2)} KG</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })()}

          </div>
        </div>

        {/* Modal Bottom Bar: Close & Tab-Specific Download Button */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Viewing:</span>
            <span className="font-bold text-slate-800 capitalize">
              {activeTab === 'client' && 'Client Summary Sheet'}
              {activeTab === 'stores' && 'Stores Summary Sheet (Internal)'}
              {activeTab === 'summary' && 'Sticker Summary Sheet (8 Cols)'}
              {activeTab === 'cipl_invoice' && 'CIPL Commercial Invoice'}
              {activeTab === 'cipl_packing' && 'CIPL Packing List'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>

            {/* Dynamic Download for Current Active Tab */}
            {activeTab === 'client' && (
              <button
                type="button"
                onClick={handleDownloadClient}
                disabled={isExporting}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow cursor-pointer transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Client Summary (.xlsx)</span>
              </button>
            )}

            {activeTab === 'stores' && (
              <button
                type="button"
                onClick={handleDownloadStores}
                disabled={isExporting}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow cursor-pointer transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Stores Sheet (.xlsx)</span>
              </button>
            )}

            {activeTab === 'summary' && (
              <button
                type="button"
                onClick={handleDownloadSummary}
                disabled={isExporting}
                className="px-5 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow cursor-pointer transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download Sticker Summary (.xlsx)</span>
              </button>
            )}

            {(activeTab === 'cipl_invoice' || activeTab === 'cipl_packing') && (
              <button
                type="button"
                onClick={handleDownloadCIPL}
                disabled={isExporting}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow cursor-pointer transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>Download CIPL Workbook (.xlsx)</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
