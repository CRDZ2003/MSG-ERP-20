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
} from 'lucide-react'
import { mergeSalesOrderMTCPackage, downloadPDFBlob } from '../../services/pdfEngine'
import { BulkCertificateUploadModal } from './BulkCertificateUploadModal'

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

  const mtcs = db.getMTCs()
  const orders = db.getOrders()
  const masterStock = db.getMasterStockView()

  // Eligible orders for MTC generation: Approved orders that need MTC package
  const approvedOrders = orders.filter(o => o.status === 'Approved' || o.status === 'MTC Generated')

  const filteredMTCs = mtcs.filter(m =>
    m.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.heat_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.certificate_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          pages: 2
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

      alert(`Official Certified MTC Package for ${order.so_number} successfully merged, stamped, and downloaded!`)
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
            <FileCheck2 className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">MTC Document Control & Stamping Center</h1>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              EN 10204 3.1 & ISO 10474
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mill test certificates repository, automatic rectangular & circular stamping, and multi-heat compilation package generator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <FolderArchive className="h-4 w-4 text-emerald-200" />
            <span>Bulk Upload Certificates (.ZIP / PDFs)</span>
          </button>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Total Certificates: <strong>{mtcs.length} Verified</strong>
          </span>
        </div>
      </div>

      {/* Success Status Banner */}
      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-semibold flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Bulk Certificate Upload Modal */}
      <BulkCertificateUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onSuccess={(msg) => setStatusMessage(msg)}
        onPreviewPDF={onPreviewMTC}
      />

      {/* Package Generator for Approved Sales Orders */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide flex items-center space-x-2">
              <Layers className="h-4 w-4 text-red-400" />
              <span>Unified Sales Order MTC Package Release</span>
            </h2>
            <p className="text-xs text-blue-200 mt-1">
              Select any storekeeper-approved order to bundle all allocated heat certificates into a single stamped PDF package.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="bg-blue-950 border border-blue-700 text-white text-xs rounded-lg px-3 py-2 font-medium focus:ring-red-500"
            >
              <option value="">-- Choose Approved Sales Order --</option>
              {approvedOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.so_number} &bull; {o.customer_name} ({o.allocations.length} Heats)
                </option>
              ))}
            </select>

            <button
              onClick={() => handleGeneratePackage(selectedOrderId)}
              disabled={!selectedOrderId || isGenerating}
              className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white font-bold text-xs px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            >
              <Download className="h-4 w-4" />
              <span>{isGenerating ? 'Compiling Package...' : 'Generate Stamped MTC Package'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search certificate reference, Heat#, Item Code, Supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Certificates Vault Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
          Certified MTC Document Registry
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
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
            <tbody className="divide-y divide-slate-100">
              {filteredMTCs.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-bold font-mono text-slate-900">{m.certificate_reference}</td>
                  <td className="p-2.5 font-mono text-slate-700">{m.item_code}</td>
                  <td className="p-2.5 font-mono font-bold text-red-700">🔥 {m.heat_number}</td>
                  <td className="p-2.5 font-semibold text-slate-700">{m.yom}</td>
                  <td className="p-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      m.purchase_type === 'local_purchase' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
