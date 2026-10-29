import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { exportLocalPurchases } from '../../services/excelEngine'
import {
  ShoppingBag,
  FileUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileCheck2,
  ExternalLink,
  Shield,
  Stamp,
} from 'lucide-react'
import { stampMTCDocument, downloadPDFBlob } from '../../services/pdfEngine'
import { registerUploadedCertificate, getUploadedCertificateBytes } from '../../services/zipExtractor'

interface LocalPurchaseManagerProps {
  onPreviewMTC: (docName: string, itemCode: string, heat: string) => void
}

export const LocalPurchaseManager: React.FC<LocalPurchaseManagerProps> = ({ onPreviewMTC }) => {
  const { currentUser, hasPermission } = useAuth()
  const localPurchases = db.getLocalPurchases()
  const masterStock = db.getMasterStockView()

  const [selectedLP, setSelectedLP] = useState<typeof localPurchases[0] | null>(null)
  const [certRef, setCertRef] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const canUploadMTC = hasPermission(['super_admin', 'mtc_controller', 'admin_inventory'])

  const handleUploadAndStamp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLP || !certRef.trim()) {
      alert('Please select a local purchase item and enter the Supplier Certificate Reference.')
      return
    }

    setIsProcessing(true)
    try {
      let rawPdfBytes: Uint8Array | null = null

      // 1. Get raw PDF from real uploaded file
      if (pdfFile) {
        const buffer = await pdfFile.arrayBuffer()
        rawPdfBytes = new Uint8Array(buffer)
      } else {
        // Check if there is an existing uploaded certificate in the MTC vault
        rawPdfBytes = getUploadedCertificateBytes(selectedLP.l_code) || getUploadedCertificateBytes(certRef.trim())
      }

      if (!rawPdfBytes) {
        alert('Please select an authentic supplier MTC (PDF) file to upload. Per MSG Oilfield compliance policy, fake or synthetic certificates cannot be generated.')
        setIsProcessing(false)
        return
      }

      // 2. Apply Dynamic MSG Oilfield Stamp to Page 1 and Circular Stamp to Page 2+
      const stampedPdfBytes = await stampMTCDocument(rawPdfBytes, {
        poNo: selectedLP.purchase_reference.split(' ')[0] || 'PO-LOCAL',
        itemNo: selectedLP.l_code,
        qty: selectedLP.received_qty,
        sign: 'MSG/QC-04',
        dateStr: new Date().toISOString().substring(0, 10).toUpperCase()
      }, true)

      const stampedFileName = `${selectedLP.l_code}_STAMPED_VERIFIED_COPY.pdf`

      // 3. Register stamped copy in certificate vault cache
      registerUploadedCertificate(selectedLP.l_code, stampedPdfBytes, stampedFileName)
      registerUploadedCertificate(certRef.trim(), stampedPdfBytes, stampedFileName)

      // 4. Trigger immediate download of stamped copy
      downloadPDFBlob(stampedPdfBytes, stampedFileName)

      // 5. Save to Database
      db.uploadAndStampSupplierMTC(
        selectedLP.id,
        certRef.trim(),
        stampedFileName,
        currentUser?.email || 'mtc@msgoilfield.ae'
      )

      alert(`Supplier Certificate for L-Code ${selectedLP.l_code} successfully stamped, verified, and linked!`)
      setSelectedLP(null)
      setCertRef('')
      setPdfFile(null)
    } catch (err: any) {
      console.error(err)
      alert('Stamping failed: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShoppingBag className="h-5 w-5 text-purple-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Local Purchases & L-Codes Workflow</h1>
            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 14 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Independent tracking of locally procured materials via unique L-Codes, with on-the-fly dual stamping of supplier MTCs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => exportLocalPurchases()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export L-Codes (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Info Card on Stamping Policy */}
      <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl text-white shadow text-xs">
        <div className="flex items-start space-x-3">
          <Shield className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">MSG Oilfield Local Purchase Stamping Protocol</div>
            <p className="text-purple-200 text-[11px] mt-1 leading-relaxed">
              When materials are purchased locally within the UAE, original supplier certificates must remain pristine.
              The system automatically renders the approved MSG Oilfield high-resolution rectangular stamp (with PO#, Item#, Qty, QC sign, and date) on Page 1, followed by circular verification stamps on subsequent pages.
            </p>
          </div>
        </div>
      </div>

      {/* Local Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
          Active Local Purchase (L-Code) Inventory Records
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="p-3">L-Code</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Local Supplier</th>
                <th className="p-3">Purchase Reference</th>
                <th className="p-3 text-center">Received Qty</th>
                <th className="p-3 text-center">YOM</th>
                <th className="p-3">Supplier MTC Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {localPurchases.map(lp => (
                <tr key={lp.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-xs">
                      {lp.l_code}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-800">{lp.item_code}</td>
                  <td className="p-3 font-medium text-slate-700">{lp.supplier_name}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-500">{lp.purchase_reference}</td>
                  <td className="p-3 text-center font-extrabold text-slate-900">{lp.received_qty} PCS</td>
                  <td className="p-3 text-center font-bold text-slate-700">{lp.yom}</td>
                  <td className="p-3">
                    {lp.supplier_mtc_uploaded ? (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center space-x-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Stamped & Verified</span>
                      </span>
                    ) : (
                      <span className="text-rose-700 font-bold text-[11px] flex items-center space-x-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Pending Supplier MTC</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {canUploadMTC && (
                        <button
                          onClick={() => {
                            setSelectedLP(lp)
                            setCertRef(`SUPPLIER-${lp.l_code}-MTC`)
                          }}
                          className="bg-purple-700 hover:bg-purple-800 text-white font-semibold text-[11px] px-2.5 py-1 rounded shadow"
                        >
                          {lp.supplier_mtc_uploaded ? 'Re-Stamp MTC' : 'Upload & Stamp MTC'}
                        </button>
                      )}

                      {lp.supplier_mtc_uploaded && (
                        <button
                          onClick={() => onPreviewMTC('/sample-mtc.pdf', lp.item_code, lp.l_code)}
                          className="text-slate-600 hover:text-purple-700 p-1"
                          title="Preview Stamped PDF"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload and Stamp Modal */}
      {selectedLP && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <FileUp className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-sm uppercase">Supplier MTC Upload & Automatic Stamping</h3>
              </div>
              <button onClick={() => setSelectedLP(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleUploadAndStamp} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="font-bold text-purple-900">Local Purchase: {selectedLP.l_code}</div>
                <div className="text-[11px] text-purple-700 mt-0.5">
                  Item: {selectedLP.item_code} | Supplier: {selectedLP.supplier_name} | Qty: {selectedLP.received_qty} PCS | YOM: {selectedLP.yom}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier Certificate Reference *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SHREE-2026-MTC-9941"
                  value={certRef}
                  onChange={(e) => setCertRef(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50 hover:bg-slate-100/60 transition-colors relative">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setPdfFile(file)
                    if (file && !certRef) {
                      setCertRef(file.name.replace(/\.[^/.]+$/, '').toUpperCase())
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileUp className="h-8 w-8 text-purple-600 mx-auto mb-1" />
                <div className="font-semibold text-slate-700">
                  {pdfFile ? pdfFile.name : 'Select Supplier Original MTC (PDF)'}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB — Ready to stamp` : 'Click or drag & drop real supplier certificate (PDF only)'}
                </p>
                {getUploadedCertificateBytes(selectedLP.l_code) && !pdfFile && (
                  <div className="mt-2 text-[10px] text-emerald-700 font-semibold bg-emerald-50 py-1 px-2 rounded border border-emerald-200 inline-block">
                    ✓ Existing MTC found in vault for this L-Code. You can click Apply Stamp or upload a new PDF.
                  </div>
                )}
              </div>

              {/* Stamp Placement Config Preview */}
              <div className="p-3 bg-red-50/50 border border-red-200 rounded-lg text-[11px] text-red-900 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <span>Stamp Injector: </span>
                  <span className="font-mono">P.O. {selectedLP.purchase_reference.split(' ')[0]} | Item: {selectedLP.l_code} | Qty: {selectedLP.received_qty} PCS</span>
                </div>
                <div>Position: Page 1 Bottom-Right (Large Rectangular) & Page 2+ (Circular QC)</div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedLP(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white rounded-lg font-bold shadow flex items-center space-x-1.5"
                >
                  <span>{isProcessing ? 'Applying Stamp...' : 'Apply Stamp & Save to Storage'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
