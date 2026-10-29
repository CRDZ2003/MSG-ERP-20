import React, { useState, useEffect } from 'react'
import { FileCheck2, Download, ExternalLink, Printer, ShieldCheck, AlertTriangle, FileX } from 'lucide-react'
import { stampMTCDocument, downloadPDFBlob } from '../../services/pdfEngine'
import { getUploadedCertificateBytes } from '../../services/zipExtractor'
import { db } from '../../services/db'

interface PDFPreviewModalProps {
  docName: string
  itemCode: string
  heatNumber: string
  onClose: () => void
}

export const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ docName, itemCode, heatNumber, onClose }) => {
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [withStamp, setWithStamp] = useState(false) // Default to EXACT ORIGINAL UNALTERED FORMAT
  const [isLoading, setIsLoading] = useState(true)
  const [isNotFound, setIsNotFound] = useState(false)
  const [realFileName, setRealFileName] = useState(docName)

  useEffect(() => {
    let isMounted = true

    async function loadCertificate() {
      setIsLoading(true)
      setIsNotFound(false)
      try {
        let rawBytes: Uint8Array | null = null
        let resolvedFileName = docName

        // 1. Check existing MTCs registered in database
        const mtcs = db.getMTCs()
        const foundMtc = mtcs.find(m => 
          (m.certificate_reference && m.certificate_reference.toLowerCase() === docName?.toLowerCase()) ||
          (m.original_file_path && m.original_file_path.toLowerCase() === docName?.toLowerCase()) ||
          (m.heat_number && m.heat_number.toLowerCase() === heatNumber?.toLowerCase())
        )

        // 2. Try to load exact original certificate bytes uploaded from the ZIP archive / memory cache
        if (foundMtc) {
          resolvedFileName = foundMtc.certificate_reference || foundMtc.original_file_path
          const cached = getUploadedCertificateBytes(foundMtc.original_file_path) || 
                         getUploadedCertificateBytes(foundMtc.certificate_reference) || 
                         getUploadedCertificateBytes(foundMtc.heat_number)
          if (cached) rawBytes = cached
        }

        if (!rawBytes) {
          const cached = getUploadedCertificateBytes(docName) || getUploadedCertificateBytes(heatNumber)
          if (cached) rawBytes = cached
        }

        // 3. Try fetching from stored original_file_path if it's an accessible URL / blob / asset
        if (!rawBytes && foundMtc?.original_file_path && (foundMtc.original_file_path.startsWith('blob:') || foundMtc.original_file_path.startsWith('data:') || foundMtc.original_file_path.startsWith('/'))) {
          try {
            const resp = await fetch(foundMtc.original_file_path)
            if (resp.ok) {
              const ab = await resp.arrayBuffer()
              rawBytes = new Uint8Array(ab)
            }
          } catch (e) {
            console.warn('Could not fetch mtc path', e)
          }
        }

        if (!rawBytes && docName && (docName.startsWith('blob:') || docName.startsWith('data:') || docName.startsWith('/'))) {
          try {
            const resp = await fetch(docName)
            if (resp.ok) {
              const ab = await resp.arrayBuffer()
              rawBytes = new Uint8Array(ab)
            }
          } catch (e) {
            console.warn('Could not fetch docName', e)
          }
        }

        // 4. STRICT RULE: DO NOT GENERATE OWN CERTIFICATE!
        // If certificate was not uploaded, flag as NOT FOUND instead of fabricating one.
        if (!rawBytes) {
          if (isMounted) {
            setIsNotFound(true)
            setPdfBytes(null)
            setPdfDataUri(null)
          }
          return
        }

        if (isMounted) {
          setRealFileName(resolvedFileName)
        }

        // 5. Render exact original from MTC or stamped working copy
        if (withStamp) {
          const stampedBytes = await stampMTCDocument(rawBytes, {
            poNo: 'PO-ADNOC-5502',
            itemNo: 'Item #01',
            qty: 10,
            sign: 'MSG/QC-04',
            dateStr: new Date().toISOString().substring(0, 10).toUpperCase()
          }, true)

          if (isMounted) {
            setPdfBytes(stampedBytes)
            const blob = new Blob([stampedBytes as any], { type: 'application/pdf' })
            setPdfDataUri(URL.createObjectURL(blob))
          }
        } else {
          // EXACT ORIGINAL UNTOUCHED CERTIFICATE AS UPLOADED FROM MTC
          if (isMounted) {
            setPdfBytes(rawBytes)
            const blob = new Blob([rawBytes as any], { type: 'application/pdf' })
            setPdfDataUri(URL.createObjectURL(blob))
          }
        }
      } catch (err) {
        console.error('Failed to load PDF preview', err)
        if (isMounted) setIsNotFound(true)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadCertificate()

    return () => {
      isMounted = false
    }
  }, [docName, itemCode, heatNumber, withStamp])

  const handleDownload = () => {
    if (!pdfBytes || isNotFound) {
      alert('Cannot download: Certificate is missing. Upload the official supplier MTC first.')
      return
    }

    const fileName = withStamp
      ? `${itemCode}_HEAT_${heatNumber}_STAMPED.pdf`
      : (realFileName.endsWith('.pdf') ? realFileName : `${itemCode}_HEAT_${heatNumber}_ORIGINAL.pdf`)

    downloadPDFBlob(pdfBytes, fileName)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="h-5 w-5 text-emerald-400" />
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm uppercase">Mill Test Certificate Viewer</h3>
                {!isNotFound && !withStamp && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded flex items-center space-x-1">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Real MTC Document (Format Preserved)</span>
                  </span>
                )}
                {!isNotFound && withStamp && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                    MSG Acceptance Stamp Overlay
                  </span>
                )}
                {isNotFound && (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                    MTC Missing
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                {itemCode} &bull; Heat: <span className="font-mono text-red-400 font-bold">{heatNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stamp Toggle - Only available if real certificate exists */}
            {!isNotFound && (
              <label className="flex items-center space-x-1.5 text-xs text-slate-200 bg-slate-800 px-2.5 py-1 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={withStamp}
                  onChange={(e) => setWithStamp(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span>Render MSG Acceptance Stamp</span>
              </label>
            )}

            {/* Download Button */}
            {!isNotFound ? (
              <button
                onClick={handleDownload}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow flex items-center space-x-1 transition-colors"
                title="Download original certificate from MTC repository"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Real MTC (.pdf)</span>
              </button>
            ) : (
              <button
                disabled
                className="bg-slate-700 text-slate-400 font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-not-allowed"
              >
                No MTC to Download
              </button>
            )}

            <button onClick={onClose} className="text-slate-300 hover:text-white text-lg p-1">✕</button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-800 p-2 overflow-hidden flex items-center justify-center">
          {isLoading ? (
            <div className="text-white text-xs flex items-center space-x-2">
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Loading real certificate from MTC repository...</span>
            </div>
          ) : isNotFound ? (
            /* Clear Warning When Certificate is Missing — No Fake Generation */
            <div className="bg-white rounded-2xl p-8 max-w-lg text-center space-y-4 shadow-2xl border border-slate-200 m-4">
              <div className="bg-rose-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <FileX className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900 uppercase tracking-tight">
                  No Mill Certificate Found in MTC Repository
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Heat Number: <strong className="font-mono text-red-700 font-bold">{heatNumber}</strong> &bull; Item: <strong>{itemCode}</strong>
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left space-y-1 text-amber-950">
                <div className="font-bold text-xs flex items-center space-x-1.5 text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Strict System Compliance Policy</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  MSG Oilfield ERP strictly prohibits synthesizing, generating, or faking mill certificates. All certificates must be genuine supplier documents downloaded from the MTC repository.
                </p>
              </div>

              <p className="text-[11px] text-slate-500">
                Please upload the official supplier MTC in <strong>MTC Document Control</strong> via <strong>.ZIP</strong> or <strong>PDF upload</strong>.
              </p>
            </div>
          ) : pdfDataUri ? (
            <iframe
              src={`${pdfDataUri}#toolbar=1`}
              title="PDF Preview"
              className="w-full h-full rounded border-0 bg-white"
            />
          ) : (
            <div className="text-slate-400 text-xs">Failed to load certificate preview.</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
          <span>Official Mill Test Certificate &bull; Sourced directly from MSG MTC Document Repository</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 text-white rounded font-semibold text-xs">
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  )
}
