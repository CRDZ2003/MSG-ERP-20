import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Tag,
  Upload,
  Download,
  Plus,
  Trash2,
  Eye,
  Save,
  FolderOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Building2,
  UserCheck,
  Search,
} from 'lucide-react'
import { db } from '../../services/db'
import {
  LOCMetadata,
  LOCItem,
  LOCDraft,
  parseExcelForLOC,
  generateLOCPdf,
  generateMaterialLocationTagsPdf,
  saveLOCDraft,
  getLOCDrafts,
  deleteLOCDraft,
  buildComplianceWording,
} from '../../services/locEngine'

export const LOCManagementPortal: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'loc' | 'tags' | 'drafts'>('loc')
  const [filterOnlyRemarks, setFilterOnlyRemarks] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Drafts state
  const [drafts, setDrafts] = useState<LOCDraft[]>([])

  // Form Metadata
  const [metadata, setMetadata] = useState<LOCMetadata>({
    date: new Date().toLocaleDateString('en-GB'),
    to_client: 'PETROFAC INTERNATIONAL LLC',
    po_number: 'PO-MSG-88902',
    msg_ref: 'MSG/LOC/2026/044',
    signatory_name: 'Vijay Dsouza',
    signatory_title: '( QA / QC Dept )',
    action_type: 'fabricated',
    custom_declaration: '',
  })

  // Signatory & Stamp options
  const [includeSignature, setIncludeSignature] = useState(true)
  const [includeStamp, setIncludeStamp] = useState(true)

  // Items state
  const [items, setItems] = useState<LOCItem[]>([
    {
      sl_no: '1',
      description: 'CONC. RED. 2" X 1.1/2", SCH.80, BW, SMLS, ASTM A/ SA 234 WPB, ASME B16.9',
      po_qty: 10,
      uom: 'PCS',
      heat_number: '68C20M091',
      remarks: 'Bevel Ends modified to Plain Ends as per client drawing DWG-REV2',
      cert_number: 'MTC-BK-2024-88',
      make: 'BENKAN',
      location: 'RACK A-04 / BIN-12',
    },
    {
      sl_no: '2',
      description: 'TEE EQUAL 3", SCH.40, BW, ASTM A234 WPB, ASME B16.9',
      po_qty: 6,
      uom: 'PCS',
      heat_number: 'HT-7721-B',
      remarks: 'Bore machined to 73.6mm internal diameter for pipe fit-up',
      cert_number: 'MTC-DEL-9901',
      make: 'DELCORTE',
      location: 'RACK B-02 / BAY-01',
    },
    {
      sl_no: '3',
      description: 'FLANGE WNRF 4", CL.300, SCH.80, ASTM A105N, ASME B16.5',
      po_qty: 4,
      uom: 'PCS',
      heat_number: 'HT-09221-M',
      remarks: 'Hydrotested to 110 BAR and certified per client inspection plan',
      cert_number: 'MTC-TK-552',
      make: 'TK FLANGES',
      location: 'RACK C-11',
    },
  ])

  // PDF Preview State
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDrafts(getLOCDrafts())
  }, [])

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 4500)
  }

  // Handle Excel Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      const parsed = await parseExcelForLOC(file)
      if (parsed.items.length === 0) {
        showNotification('No item rows could be parsed from the uploaded Excel file.', 'error')
      } else {
        setMetadata(prev => ({
          ...prev,
          ...parsed.metadata,
          to_client: parsed.metadata.to_client || prev.to_client,
          po_number: parsed.metadata.po_number || prev.po_number,
          msg_ref: parsed.metadata.msg_ref || prev.msg_ref,
        }))
        setItems(parsed.items)
        showNotification(`Successfully imported ${parsed.items.length} items from ${file.name}!`, 'success')
      }
    } catch (err: any) {
      showNotification(`Failed to parse Excel file: ${err.message}`, 'error')
    } finally {
      setIsProcessing(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Load from existing ERP Sales Order
  const handleLoadOrder = (orderId: string) => {
    const orders = db.getOrders()
    const found = orders.find(o => o.id === orderId)
    if (!found) return

    setMetadata(prev => ({
      ...prev,
      to_client: found.customer_name,
      po_number: found.po_number,
      msg_ref: `MSG/LOC/${found.id}`,
    }))

    const newItems: LOCItem[] = (found.items || []).map((it, idx) => {
      const allocation = (found.allocations || []).find(a => a.sales_order_item_id === it.id)
      const heat = allocation?.heat_number || it.heat_number || 'N/A'
      return {
        sl_no: String(idx + 1),
        description: it.item_description,
        po_qty: it.required_qty,
        uom: it.uom,
        heat_number: heat,
        remarks: it.allocated_qty ? `Allocated ${it.allocated_qty} ${it.uom}` : '',
        make: '',
        location: it.location || (heat !== 'N/A' ? `RACK ${heat.substring(0, 3)}` : 'LOC: UNASSIGNED'),
      }
    })

    setItems(newItems)
    showNotification(`Loaded ${newItems.length} items from Sales Order ${found.po_number}!`, 'success')
  }

  // Filter items if toggle is active
  const displayedItems = filterOnlyRemarks
    ? items.filter(it => it.remarks && it.remarks.trim().length > 0)
    : items

  // Line item actions
  const handleUpdateItem = (index: number, field: keyof LOCItem, value: any) => {
    setItems(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleDeleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddItem = () => {
    const newItem: LOCItem = {
      sl_no: String(items.length + 1),
      description: '',
      po_qty: 1,
      uom: 'PCS',
      heat_number: '',
      remarks: '',
      location: '',
    }
    setItems(prev => [...prev, newItem])
  }

  // Download LOC PDF
  const handleDownloadLOC = async () => {
    if (displayedItems.length === 0) {
      showNotification('Cannot generate LOC: No items available to include.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const pdfBytes = await generateLOCPdf(metadata, displayedItems, {
        includeSignature,
        includeStamp,
      })
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Letter_of_Compliance_${metadata.po_number || 'Document'}.pdf`.replace(/\s+/g, '_')
      a.click()
      URL.revokeObjectURL(url)
      showNotification('Letter of Compliance PDF generated and downloaded successfully!', 'success')
    } catch (err: any) {
      showNotification(`Failed to generate LOC PDF: ${err.message}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Preview LOC PDF
  const handlePreviewLOC = async () => {
    if (displayedItems.length === 0) {
      showNotification('Cannot preview: No items available to include.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const pdfBytes = await generateLOCPdf(metadata, displayedItems, {
        includeSignature,
        includeStamp,
      })
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewPdfUrl(url)
      setPreviewTitle(`Letter of Compliance - ${metadata.po_number || 'Preview'}`)
    } catch (err: any) {
      showNotification(`Failed to preview LOC PDF: ${err.message}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Download Location Tags PDF
  const handleDownloadTags = async () => {
    if (items.length === 0) {
      showNotification('Cannot generate Material Tags: No items available.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const pdfBytes = await generateMaterialLocationTagsPdf(items, {
        clientName: metadata.to_client,
        poNumber: metadata.po_number,
        includeSignature,
      })
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Material_Location_Tags_${metadata.po_number || 'A4'}.pdf`.replace(/\s+/g, '_')
      a.click()
      URL.revokeObjectURL(url)
      showNotification('A4 Material Location Tags (2-per-page) generated and downloaded!', 'success')
    } catch (err: any) {
      showNotification(`Failed to generate Tags PDF: ${err.message}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Preview Location Tags PDF
  const handlePreviewTags = async () => {
    if (items.length === 0) {
      showNotification('Cannot preview: No items available.', 'error')
      return
    }

    setIsProcessing(true)
    try {
      const pdfBytes = await generateMaterialLocationTagsPdf(items, {
        clientName: metadata.to_client,
        poNumber: metadata.po_number,
        includeSignature,
      })
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPreviewPdfUrl(url)
      setPreviewTitle(`Material Location Tags - ${metadata.po_number || 'Preview'}`)
    } catch (err: any) {
      showNotification(`Failed to preview Tags PDF: ${err.message}`, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Save draft
  const handleSaveDraft = () => {
    const saved = saveLOCDraft(metadata, items)
    setDrafts(getLOCDrafts())
    showNotification(`Saved draft "${saved.id}" successfully!`, 'success')
  }

  const handleRestoreDraft = (draft: LOCDraft) => {
    setMetadata(draft.metadata)
    setItems(draft.items)
    setActiveMode('loc')
    showNotification(`Restored draft from ${new Date(draft.timestamp).toLocaleString()}!`, 'success')
  }

  const handleDeleteDraft = (id: string) => {
    deleteLOCDraft(id)
    setDrafts(getLOCDrafts())
    showNotification('Draft deleted.', 'info')
  }

  const { verb, noun } = buildComplianceWording(metadata.action_type)
  const existingOrders = db.getOrders()

  return (
    <div className="space-y-6">
      {/* Top Banner / Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-300 text-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-semibold">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-700 to-indigo-900 text-white rounded-xl shadow-md">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <span>Letter of Compliance (LOC) & Material Tags</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    MSGEE1 Engine
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate official Letter of Compliance with vector letterhead & print-ready A4 Material Location tags (2-per-page)
                </p>
              </div>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setActiveMode('loc')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'loc'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Letter of Compliance (LOC)</span>
            </button>
            <button
              onClick={() => setActiveMode('tags')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'tags'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tag className="h-4 w-4" />
              <span>Material Location Tags (A4)</span>
            </button>
            <button
              onClick={() => setActiveMode('drafts')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === 'drafts'
                  ? 'bg-white text-blue-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Saved Backups ({drafts.length})</span>
            </button>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Upload Excel */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
            >
              <Upload className="h-3.5 w-3.5 text-blue-600" />
              <span>Upload Summary Excel</span>
            </button>

            {/* Load from Order */}
            <div className="flex items-center space-x-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <select
                onChange={e => e.target.value && handleLoadOrder(e.target.value)}
                defaultValue=""
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="" disabled>
                  Load from ERP Sales Order...
                </option>
                {existingOrders.map(ord => (
                  <option key={ord.id} value={ord.id}>
                    {ord.po_number} ({ord.customer_name}) - {ord.items?.length || 0} items
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Remarks Toggle */}
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 select-none">
              <input
                type="checkbox"
                checked={filterOnlyRemarks}
                onChange={e => setFilterOnlyRemarks(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Only Items with Remarks ({items.filter(i => i.remarks && i.remarks.trim()).length})</span>
            </label>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveDraft}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
            >
              <Save className="h-3.5 w-3.5 text-slate-500" />
              <span>Save Backup</span>
            </button>

            {activeMode === 'loc' ? (
              <>
                <button
                  onClick={handlePreviewLOC}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold shadow-sm transition"
                >
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  <span>Preview LOC</span>
                </button>
                <button
                  onClick={handleDownloadLOC}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white text-xs font-bold shadow-sm transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download LOC PDF</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handlePreviewTags}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold shadow-sm transition"
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Preview Tags</span>
                </button>
                <button
                  onClick={handleDownloadTags}
                  disabled={isProcessing}
                  className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-indigo-700 to-purple-800 hover:from-indigo-800 hover:to-purple-900 text-white text-xs font-bold shadow-sm transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download A4 Tags PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODE 1: LETTER OF COMPLIANCE */}
      {activeMode === 'loc' && (
        <div className="space-y-6">
          {/* Metadata & Signatory Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Certificate Metadata & Compliance Statement</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Date</label>
                <input
                  type="text"
                  value={metadata.date}
                  onChange={e => setMetadata({ ...metadata, date: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">TO (Client Name)</label>
                <input
                  type="text"
                  value={metadata.to_client}
                  onChange={e => setMetadata({ ...metadata, to_client: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  placeholder="e.g. VALUED CUSTOMER"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Customer PO Number</label>
                <input
                  type="text"
                  value={metadata.po_number}
                  onChange={e => setMetadata({ ...metadata, po_number: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">MSG Reference No</label>
                <input
                  type="text"
                  value={metadata.msg_ref}
                  onChange={e => setMetadata({ ...metadata, msg_ref: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Action Type & Signatory Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Compliance Action Type
                </label>
                <select
                  value={metadata.action_type}
                  onChange={e => setMetadata({ ...metadata, action_type: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold bg-white text-blue-900"
                >
                  <option value="fabricated">Fabricated (Fabrication)</option>
                  <option value="machined">Machined (Machining)</option>
                  <option value="modified">Modified (Modification)</option>
                  <option value="tested">Tested / Inspected (Testing & Inspection)</option>
                  <option value="certified">Verified & Certified</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Authorized Signatory Name
                </label>
                <input
                  type="text"
                  value={metadata.signatory_name}
                  onChange={e => setMetadata({ ...metadata, signatory_name: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Signatory Title / Department
                </label>
                <input
                  type="text"
                  value={metadata.signatory_title}
                  onChange={e => setMetadata({ ...metadata, signatory_title: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>
            </div>

            {/* Live Compliance Statement Preview */}
            <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider block mb-1">
                Generated Legal Compliance Statement:
              </span>
              <p className="text-xs text-slate-800 italic leading-relaxed">
                "We hereby confirm that below listed items have been <b className="text-blue-900 underline">{verb}</b> as per the client PO requirements. Subsequent to the <b className="text-blue-900 underline">{noun}</b>, dimensional verification and visual inspection were conducted, and the items are found to be acceptable and in full compliance with the applicable standards."
              </p>
            </div>

            {/* Signature & Seal Toggles */}
            <div className="flex flex-wrap items-center gap-6 mt-4 pt-3 border-t border-slate-100">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={e => setIncludeSignature(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>Include Authorized Signature (Vijay Dsouza)</span>
              </label>

              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStamp}
                  onChange={e => setIncludeStamp(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>Include Official QA/QC Red Seal Stamp</span>
              </label>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Compliance Items ({displayedItems.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Items printed on the Letter of Compliance certificate. Only items with Remarks are typically required.
                </p>
              </div>
              <button
                onClick={handleAddItem}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3 w-14 text-center">Sl.No</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Description</th>
                    <th className="py-2.5 px-3 w-20 text-center">PO Qty</th>
                    <th className="py-2.5 px-3 w-16 text-center">UOM</th>
                    <th className="py-2.5 px-3 w-28">Heat Number</th>
                    <th className="py-2.5 px-3 min-w-[220px]">
                      <span className="text-blue-900 font-extrabold">Remarks (Action Taken)</span>
                    </th>
                    <th className="py-2.5 px-3 w-32">Location / Bin</th>
                    <th className="py-2.5 px-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No items matching current filters. Click "Add Item" or uncheck "Only Items with Remarks".
                      </td>
                    </tr>
                  ) : (
                    displayedItems.map((item, idx) => {
                      const realIndex = items.indexOf(item)
                      return (
                        <tr key={idx} className="hover:bg-blue-50/40 transition">
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.sl_no}
                              onChange={e => handleUpdateItem(realIndex, 'sl_no', e.target.value)}
                              className="w-10 text-center text-xs p-1 border border-slate-200 rounded font-semibold"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <textarea
                              rows={2}
                              value={item.description}
                              onChange={e => handleUpdateItem(realIndex, 'description', e.target.value)}
                              className="w-full text-xs p-1.5 border border-slate-200 rounded resize-none font-medium focus:ring-1 focus:ring-blue-500"
                              placeholder="Material description..."
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.po_qty}
                              onChange={e => handleUpdateItem(realIndex, 'po_qty', e.target.value)}
                              className="w-16 text-center text-xs p-1 border border-slate-200 rounded font-bold"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              value={item.uom}
                              onChange={e => handleUpdateItem(realIndex, 'uom', e.target.value)}
                              className="w-12 text-center text-xs p-1 border border-slate-200 rounded font-medium"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.heat_number}
                              onChange={e => handleUpdateItem(realIndex, 'heat_number', e.target.value)}
                              className="w-full text-xs p-1 border border-slate-200 rounded font-mono text-blue-800 font-bold"
                              placeholder="Heat #"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.remarks}
                              onChange={e => handleUpdateItem(realIndex, 'remarks', e.target.value)}
                              className="w-full text-xs p-1.5 border border-blue-200 bg-blue-50/30 rounded font-medium text-slate-800 focus:ring-1 focus:ring-blue-500"
                              placeholder="e.g. Bevel End to Plain End per drawing"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.location || ''}
                              onChange={e => handleUpdateItem(realIndex, 'location', e.target.value)}
                              className="w-full text-xs p-1 border border-slate-200 rounded text-slate-700"
                              placeholder="e.g. RACK A-04"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => handleDeleteItem(realIndex)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MATERIAL LOCATION TAGS */}
      {activeMode === 'tags' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-indigo-600" />
                  <span>A4 Material Location Tags (2-per-page)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  High-visibility bin cards for storekeepers, warehouse racks, and QA/QC material traceability.
                </p>
              </div>
              <button
                onClick={handleDownloadTags}
                disabled={isProcessing}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold shadow-sm transition shrink-0"
              >
                <Download className="h-4 w-4" />
                <span>Download All Tags PDF</span>
              </button>
            </div>

            {/* Tags Grid Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {items.map((item, idx) => {
                const isFound = item.location && item.location.trim().length > 0
                return (
                  <div
                    key={idx}
                    className="border-2 border-blue-900 rounded-xl p-4 bg-white shadow-md relative overflow-hidden flex flex-col justify-between"
                  >
                    {/* Tag Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div>
                        <div className="text-[11px] font-black text-blue-950 uppercase tracking-wider">
                          MSG OILFIELD SUPPLIES
                        </div>
                        <div className="text-[9px] font-bold text-slate-400">MATERIAL LOCATION / LOC</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-red-600">SL NO: {item.sl_no}</span>
                        <div className="text-[9px] text-slate-400">PO: {metadata.po_number || 'N/A'}</div>
                      </div>
                    </div>

                    {/* High Visibility Location Badge */}
                    <div
                      className={`my-3 p-3 text-center rounded-lg border ${
                        isFound
                          ? 'bg-blue-50 border-blue-300 text-blue-950'
                          : 'bg-rose-50 border-rose-300 text-rose-700'
                      }`}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        STORE / RACK / BIN LOCATION
                      </div>
                      <div className="text-lg font-black tracking-tight mt-0.5">
                        {isFound ? item.location?.toUpperCase() : 'LOC: NOT FOUND'}
                      </div>
                    </div>

                    {/* Specs Details */}
                    <div className="space-y-1.5 text-xs text-slate-700 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60 mb-3">
                      <div>
                        <span className="font-bold text-slate-500 text-[10px] uppercase block">Description:</span>
                        <span className="font-semibold text-slate-900">{item.description}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="font-bold text-slate-500 text-[10px] uppercase block">Quantity / UOM:</span>
                          <span className="font-bold text-slate-900">{item.po_qty} {item.uom}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500 text-[10px] uppercase block">Heat Number:</span>
                          <span className="font-mono font-bold text-blue-800">{item.heat_number || 'N/A'}</span>
                        </div>
                      </div>
                      {item.remarks && (
                        <div className="pt-1 border-t border-slate-200/60">
                          <span className="font-bold text-slate-500 text-[10px] uppercase block">Compliance Remarks:</span>
                          <span className="italic text-slate-800">{item.remarks}</span>
                        </div>
                      )}
                    </div>

                    {/* Verification Section */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                      <div>
                        <div className="font-bold text-slate-700">STOREKEEPER</div>
                        <div>Physical Location Tagged</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-700">QA/QC INSPECTOR</div>
                        <div className="font-semibold text-slate-800">Vijay Dsouza (QA/QC)</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: DRAFTS & BACKUPS */}
      {activeMode === 'drafts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-blue-600" />
                <span>Saved LOC & Tag Worksheets</span>
              </h2>
              <p className="text-xs text-slate-500">
                Restore previously saved Letter of Compliance worksheets or clean up old drafts.
              </p>
            </div>
            <button
              onClick={handleSaveDraft}
              className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Current Worksheet</span>
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FolderOpen className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">No saved drafts found.</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "Save Backup" anytime to snapshot your worksheet here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {drafts.map(draft => (
                <div key={draft.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-blue-800">{draft.id}</span>
                      <span className="text-xs font-semibold text-slate-800">
                        {draft.metadata.po_number || 'No PO'} — {draft.metadata.to_client || 'No Client'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-4">
                      <span>Saved: {new Date(draft.timestamp).toLocaleString()}</span>
                      <span>Items: {draft.items.length}</span>
                      <span>Action: {draft.metadata.action_type}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleRestoreDraft(draft)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 font-bold rounded-lg text-xs transition flex items-center space-x-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete Draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* In-App PDF Previewer Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <FileText className="h-5 w-5 text-blue-400" />
                <span className="font-bold text-sm">{previewTitle}</span>
              </div>
              <div className="flex items-center space-x-2">
                <a
                  href={previewPdfUrl}
                  download={`${previewTitle.replace(/\s+/g, '_')}.pdf`}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center space-x-1 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewPdfUrl)
                    setPreviewPdfUrl(null)
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewPdfUrl}
                title="PDF Preview"
                className="w-full h-full rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
