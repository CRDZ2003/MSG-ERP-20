import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import {
  FileCheck2,
  Download,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Layers,
  FileUp,
  FileText,
  Building,
  FolderArchive,
  Sparkles,
  CheckSquare,
  Square,
  FileDown,
  X,
} from 'lucide-react'
import {
  mergeSalesOrderMTCPackage,
  mergeSelectedCertificates,
  downloadCertificatesAsZip,
  downloadPDFBlob,
} from '../../services/pdfEngine'
import { getUploadedCertificateBytes } from '../../services/zipExtractor'
import { BulkCertificateUploadModal } from './BulkCertificateUploadModal'
import { MTCCertificate } from '../../types'

interface MTCManagementProps {
  onPreviewMTC: (docName: string, itemCode: string, heat: string) => void
}

export const MTCManagement: React.FC<MTCManagementProps> = ({ onPreviewMTC }) => {
  const { currentUser, hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Multi-Selection State for Bulk Download ("Tick and Download All Together")
  const [selectedCertIds, setSelectedCertIds] = useState<Set<string>>(new Set())
  const [isBatchDownloading, setIsBatchDownloading] = useState(false)
  const [batchActionType, setBatchActionType] = useState<'merged' | 'zip' | null>(null)

  const mtcs = db.getMTCs()
  const orders = db.getOrders()
  const masterStock = db.getMasterStockView()

  // Eligible orders for MTC generation: Approved orders that need MTC package
  const approvedOrders = orders.filter(o => o.status === 'Approved' || o.status === 'MTC Generated')

  // Multi-term search (split by commas, semicolons, or newlines)
  // Allows searching multiple Heat Numbers at once, e.g. "889, A-2212, 106480"
  const searchTokens = searchTerm
    .split(/[,;\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)

  const filteredMTCs = mtcs.filter(m => {
    if (searchTokens.length === 0) return true
    const itemCode = m.item_code.toLowerCase()
    const heat = m.heat_number.toLowerCase()
    const certRef = m.certificate_reference.toLowerCase()
    const supplier = m.supplier_name.toLowerCase()
    const lCode = (m.l_code || '').toLowerCase()

    return searchTokens.some(token =>
      itemCode.includes(token) ||
      heat.includes(token) ||
      certRef.includes(token) ||
      supplier.includes(token) ||
      lCode.includes(token)
    )
  })

  // Checkbox helpers
  const allFilteredSelected =
    filteredMTCs.length > 0 && filteredMTCs.every(m => selectedCertIds.has(m.id))

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect filtered
      const updated = new Set(selectedCertIds)
      filteredMTCs.forEach(m => updated.delete(m.id))
      setSelectedCertIds(updated)
    } else {
      // Select all filtered
      const updated = new Set(selectedCertIds)
      filteredMTCs.forEach(m => updated.add(m.id))
      setSelectedCertIds(updated)
    }
  }

  const handleToggleSelectOne = (id: string) => {
    const updated = new Set(selectedCertIds)
    if (updated.has(id)) {
      updated.delete(id)
    } else {
      updated.add(id)
    }
    setSelectedCertIds(updated)
  }

  // Retrieve raw bytes for a certificate (from ZIP cache, local storage, or preloaded assets)
  const getCertBytes = async (m: MTCCertificate): Promise<Uint8Array | null> => {
    const cached =
      getUploadedCertificateBytes(m.certificate_reference) ||
      getUploadedCertificateBytes(m.heat_number) ||
      getUploadedCertificateBytes(m.l_code) ||
      getUploadedCertificateBytes(m.original_file_path)

    if (cached) return cached

    if (m.original_file_path) {
      try {
        const resp = await fetch(m.original_file_path)
        if (resp.ok) {
          const buf = await resp.arrayBuffer()
          return new Uint8Array(buf)
        }
      } catch (e) {
        console.warn('Could not fetch path:', m.original_file_path, e)
      }
    }
    return null
  }

  // Bulk Download Option 1: Merged PDF (Compiles all ticked certificates into a single PDF)
  const handleDownloadSelectedMerged = async () => {
    if (selectedCertIds.size === 0) return

    setIsBatchDownloading(true)
    setBatchActionType('merged')
    try {
      const selectedMTCs = mtcs.filter(m => selectedCertIds.has(m.id))
      const list: { fileName: string; heatNumber: string; itemCode: string; bytes: Uint8Array }[] = []

      for (const m of selectedMTCs) {
        const bytes = await getCertBytes(m)
        if (bytes) {
          list.push({
            fileName: m.certificate_reference.toLowerCase().endsWith('.pdf')
              ? m.certificate_reference
              : `${m.certificate_reference}.pdf`,
            heatNumber: m.heat_number,
            itemCode: m.item_code,
            bytes,
          })
        }
      }

      if (list.length === 0) {
        alert('Could not retrieve authentic PDF documents for the selected certificates. Please check uploaded files.')
        return
      }

      const mergedBytes = await mergeSelectedCertificates(list)
      const downloadName = `MSG_MTC_Batch_${list.length}_Certificates.pdf`
      downloadPDFBlob(mergedBytes, downloadName)

      setStatusMessage(`Successfully merged and downloaded ${list.length} selected certificates into ${downloadName}!`)
    } catch (err: any) {
      alert('Error merging selected certificates: ' + err.message)
    } finally {
      setIsBatchDownloading(false)
      setBatchActionType(null)
    }
  }

  // Bulk Download Option 2: ZIP Package (Downloads all ticked certificates bundled in a .zip archive)
  const handleDownloadSelectedZip = async () => {
    if (selectedCertIds.size === 0) return

    setIsBatchDownloading(true)
    setBatchActionType('zip')
    try {
      const selectedMTCs = mtcs.filter(m => selectedCertIds.has(m.id))
      const list: { fileName: string; bytes: Uint8Array }[] = []

      for (const m of selectedMTCs) {
        const bytes = await getCertBytes(m)
        if (bytes) {
          list.push({
            fileName: m.certificate_reference.toLowerCase().endsWith('.pdf')
              ? m.certificate_reference
              : `${m.certificate_reference}.pdf`,
            bytes,
          })
        }
      }

      if (list.length === 0) {
        alert('Could not retrieve authentic PDF documents for the selected certificates.')
        return
      }

      const zipName = `MSG_MTC_Selected_${list.length}_Certificates.zip`
      await downloadCertificatesAsZip(list, zipName)

      setStatusMessage(`Successfully bundled and downloaded ${list.length} selected certificates into ${zipName}!`)
    } catch (err: any) {
      alert('Error packaging selected certificates to ZIP: ' + err.message)
    } finally {
      setIsBatchDownloading(false)
      setBatchActionType(null)
    }
  }

  const handleGeneratePackage = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId)
    if (!order) return

    if (order.status !== 'Approved' && order.status !== 'MTC Generated') {
      alert('Order must be approved by Storekeeper before MTC package can be released.')
      return
    }

    setIsGenerating(true)
    try {
      // Collect certificates for all allocated heats
      const allocatedCerts = order.allocations.map(alloc => {
        const lot = masterStock.find(s => s.id === alloc.stock_lot_id)
        return {
          itemCode: lot?.item_code || '',
          heatNumber: alloc.heat_number,
          yom: lot?.yom || 2025,
          lCode: lot?.l_code,
          qty: alloc.allocated_qty,
          isLocal: lot?.purchase_type === 'local_purchase',
          pages: 2,
        }
      })

      const pdfBytes = await mergeSalesOrderMTCPackage(
        order.so_number,
        order.customer_name,
        order.po_number,
        allocatedCerts
      )

      downloadPDFBlob(pdfBytes, `${order.so_number}_CERTIFIED_MTC_PACKAGE.pdf`)

      db.markMTCPackageGenerated(
        order.id,
        `${order.so_number}_CERTIFIED_MTC_PACKAGE.pdf`,
        currentUser?.email || 'mtc@msgoilfield.ae'
      )

      setStatusMessage(`Official Certified MTC Package for ${order.so_number} successfully merged, stamped, and downloaded!`)
    } catch (err: any) {
      console.error(err)
      alert('Error generating MTC package: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FileCheck2 className="h-5 w-5 text-red-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Material Test Certificates (MTC) Management</h1>
            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              EN 10204 3.1 Certified
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search single or multiple heat numbers, tick certificates, and download them all at once as a merged PDF or ZIP archive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(['super_admin', 'mtc_controller', 'admin_inventory']) && (
            <button
              onClick={() => setShowBulkUpload(true)}
              className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <FolderArchive className="h-4 w-4 text-purple-200" />
              <span>Bulk Upload Certificates (.ZIP / PDFs)</span>
            </button>
          )}

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
            <Building className="h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">Total in Vault:</span>
            <span className="font-mono font-bold text-red-700">{mtcs.length} MTCs</span>
          </div>
        </div>
      </div>

      <BulkCertificateUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={(msg) => setStatusMessage(msg)}
        onPreviewPDF={onPreviewMTC}
      />

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Auto-Package Merging Box for Approved Sales Orders */}
      <div className="bg-slate-900 text-white p-5 rounded-xl shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              1-Click Sales Order MTC Package Compiler
            </h2>
          </div>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-500/30">
            Storekeeper Approval Mandatory
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-[11px] text-slate-300 font-medium mb-1">
              Select Storekeeper-Approved Order to Compile MTC Dossier:
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 text-xs font-mono"
            >
              <option value="">-- Choose Approved Sales Order ({approvedOrders.length} eligible) --</option>
              {approvedOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.so_number} &bull; {o.customer_name} ({o.allocations.length} Heats)
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => handleGeneratePackage(selectedOrderId)}
              disabled={!selectedOrderId || isGenerating}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-colors flex items-center justify-center space-x-1.5"
            >
              <Download className="h-4 w-4" />
              <span>{isGenerating ? 'Compiling Package...' : 'Generate Stamped MTC Package'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MULTI-SEARCH BAR (Supports multiple comma-separated heats) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search multiple Heat# (e.g. 889, A-2212, 106480), Item Code, Ref, Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searchTokens.length > 1 && (
            <div className="flex items-center space-x-1 text-[11px] bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg border border-blue-200 font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Multi-Search Active: {searchTokens.length} terms matched</span>
            </div>
          )}
        </div>

        <p className="text-[10px] text-slate-400">
          💡 <strong>Tip:</strong> Paste multiple Heat Numbers separated by commas (e.g., <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded">889, A-2212, 106480, S22408</code>) to find all of them together, tick the boxes, and download at once.
        </p>
      </div>

      {/* BATCH DOWNLOAD ACTION BAR (Appears when 1 or more certificates are ticked) */}
      {selectedCertIds.size > 0 && (
        <div className="sticky top-2 z-20 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-4 rounded-xl shadow-xl border border-indigo-400/30 flex flex-wrap justify-between items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <span className="bg-emerald-500 text-white font-bold text-xs px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-sm">
              <CheckSquare className="h-3.5 w-3.5" />
              <span>{selectedCertIds.size} Ticked / Selected</span>
            </span>
            <span className="text-xs text-slate-200 hidden sm:inline">
              Download authentic original documents together in 1 click:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadSelectedMerged}
              disabled={isBatchDownloading}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <FileDown className="h-4 w-4" />
              <span>
                {isBatchDownloading && batchActionType === 'merged'
                  ? 'Compiling Combined PDF...'
                  : `Download Merged PDF (${selectedCertIds.size})`}
              </span>
            </button>

            <button
              onClick={handleDownloadSelectedZip}
              disabled={isBatchDownloading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <FolderArchive className="h-4 w-4" />
              <span>
                {isBatchDownloading && batchActionType === 'zip'
                  ? 'Bundling ZIP...'
                  : `Download as ZIP (${selectedCertIds.size})`}
              </span>
            </button>

            <button
              onClick={() => setSelectedCertIds(new Set())}
              className="bg-white/10 hover:bg-white/20 text-slate-200 text-xs px-3 py-2 rounded-lg transition-colors font-medium"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* CERTIFICATES VAULT TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span>Certified MTC Document Registry</span>
            <span className="text-[11px] font-mono text-slate-500 font-normal">
              ({filteredMTCs.length} matching certificate records)
            </span>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-normal">
            <button
              onClick={handleToggleSelectAll}
              className="text-blue-700 font-bold hover:underline flex items-center space-x-1"
            >
              {allFilteredSelected ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-blue-700" />
                  <span>Deselect All Filtered</span>
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-500" />
                  <span>Tick All ({filteredMTCs.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold sticky top-0 shadow-sm z-10">
              <tr>
                <th className="p-2.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAll}
                    title="Tick / Untick All Filtered Certificates"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="p-2.5">Certificate Ref</th>
                <th className="p-2.5">Item Code</th>
                <th className="p-2.5">Heat Number</th>
                <th className="p-2.5">YOM</th>
                <th className="p-2.5">Purchase Type</th>
                <th className="p-2.5">L-Code</th>
                <th className="p-2.5">Mill / Supplier</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredMTCs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400">
                    No certificates found matching your search.
                  </td>
                </tr>
              ) : (
                filteredMTCs.map(m => {
                  const isSelected = selectedCertIds.has(m.id)

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(m.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                        />
                      </td>
                      <td className="p-2.5 font-bold font-mono text-slate-900">{m.certificate_reference}</td>
                      <td className="p-2.5 font-mono text-slate-700">{m.item_code}</td>
                      <td className="p-2.5 font-mono font-bold text-red-700">🔥 {m.heat_number}</td>
                      <td className="p-2.5 font-semibold text-slate-700">{m.yom}</td>
                      <td className="p-2.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            m.purchase_type === 'local_purchase'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {m.purchase_type === 'local_purchase' ? 'Local Purchase' : 'Mill Stock'}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono text-amber-800 font-semibold">{m.l_code || '-'}</td>
                      <td className="p-2.5 text-slate-600">{m.supplier_name}</td>
                      <td className="p-2.5">
                        <span className="text-emerald-700 font-bold flex items-center space-x-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{m.verification_status}</span>
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => onPreviewMTC(m.original_file_path, m.item_code, m.heat_number)}
                          className="text-blue-700 hover:text-blue-900 font-semibold flex items-center justify-center space-x-1 mx-auto hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Preview</span>
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
  )
}
