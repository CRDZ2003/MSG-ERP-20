import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import {
  extractCertificatesFromZip,
  extractCertificatesFromPDFFiles,
  ExtractedCertificate
} from '../../services/zipExtractor'
import {
  FileUp,
  FolderArchive,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Download,
  ExternalLink,
  X,
  FileText,
  Sparkles,
  Link2,
} from 'lucide-react'
import JSZip from 'jszip'

interface BulkCertificateUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (msg: string) => void
  onPreviewPDF?: (url: string, itemCode: string, heat: string) => void
}

export const BulkCertificateUploadModal: React.FC<BulkCertificateUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onPreviewPDF,
}) => {
  const { currentUser } = useAuth()
  const masterStock = db.getMasterStockView()

  const [extractedList, setExtractedList] = useState<ExtractedCertificate[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [activeFileName, setActiveFileName] = useState('')

  if (!isOpen) return null

  // Handle ZIP or Multiple PDF selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsProcessing(true)
    try {
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        setActiveFileName(files[0].name)
        const certs = await extractCertificatesFromZip(files[0])
        setExtractedList(certs)
      } else {
        setActiveFileName(`${files.length} PDF files selected`)
        const certs = await extractCertificatesFromPDFFiles(files)
        setExtractedList(certs)
      }
    } catch (err: any) {
      alert('Failed to extract certificates: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Generate & Download a Test Sample ZIP Archive with dummy MTC PDFs for testing
  const handleDownloadSampleZip = async () => {
    setIsProcessing(true)
    try {
      const zip = new JSZip()
      const samplePdfResp = await fetch('/sample-mtc.pdf')
      const samplePdfBytes = await samplePdfResp.arrayBuffer()

      // Add sample certificates matching MSG stock heats
      zip.file('889.pdf', samplePdfBytes)
      zip.file('A-2212.pdf', samplePdfBytes)
      zip.file('A-2211.pdf', samplePdfBytes)
      zip.file('980.pdf', samplePdfBytes)
      zip.file('67C00M083.pdf', samplePdfBytes)
      zip.file('LOC-A2212-LP.pdf', samplePdfBytes)
      zip.file('SRI2786.pdf', samplePdfBytes)
      zip.file('ULMA-8841.pdf', samplePdfBytes)
      zip.file('MG-9921B.pdf', samplePdfBytes)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'MSG_Sample_Certificates_Archive.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err: any) {
      alert('Error creating sample zip: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpdateHeatNumber = (id: string, newHeat: string) => {
    setExtractedList(prev => prev.map(item => {
      if (item.id !== id) return item
      const cleanHeat = newHeat.trim()
      const matchedLot = masterStock.find(s => s.heat_number.trim().toUpperCase() === cleanHeat.toUpperCase())
      return {
        ...item,
        heatNumber: cleanHeat,
        detectedItemCode: matchedLot?.item_code,
        matchedLotId: matchedLot?.id,
        matchedItemDescription: matchedLot?.item_description,
        matchStatus: matchedLot ? 'matched' : 'unmatched',
        supplierName: matchedLot?.supplier_name,
        purchaseType: matchedLot?.purchase_type,
        lCode: matchedLot?.l_code
      }
    }))
  }

  const handleCommitCertificates = () => {
    if (extractedList.length === 0) return
    setIsCommitting(true)

    try {
      const certFiles = extractedList.map(item => ({
        fileName: item.fileName,
        heatNumber: item.heatNumber,
        itemCode: item.detectedItemCode,
        fileDataUrl: item.pdfBlobUrl,
        supplierName: item.supplierName,
        purchaseType: item.purchaseType,
        lCode: item.lCode
      }))

      const res = db.bulkUploadCertificates(certFiles, currentUser?.email || 'mtc@msgoilfield.ae')

      onSuccess?.(`Successfully processed ${res.total} certificates! ${res.linkedToStock} certificates directly linked to stock lots (MTC status updated to Verified).`)
      onClose()
    } catch (err: any) {
      alert('Error committing certificates: ' + err.message)
    } finally {
      setIsCommitting(false)
    }
  }

  const matchedCount = extractedList.filter(c => c.matchStatus === 'matched').length
  const unmatchedCount = extractedList.filter(c => c.matchStatus === 'unmatched').length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0B2545] text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <FolderArchive className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Bulk Certificate Upload (.ZIP / Multi-PDF)</h2>
              <p className="text-[11px] text-blue-200">
                Upload a .zip file of PDF certificates. The system automatically extracts files and links each certificate to matching Heat Numbers in Master Stock.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Top Dropzone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 text-center bg-slate-50/70 transition-colors">
            <input
              type="file"
              id="zipUploadInput"
              accept=".zip, .pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="zipUploadInput" className="cursor-pointer block">
              <FolderArchive className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800">
                Click to Select or Drop Certificate ZIP Archive (.zip) or Multiple PDFs
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Name your certificate files by Heat Number (e.g. <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded">889.pdf</code>, <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded">A-2212.pdf</code>, <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded">MTC-980.pdf</code>) for automatic 1-to-1 matching.
              </p>
            </label>

            <div className="mt-3 flex justify-center items-center space-x-2">
              <button
                type="button"
                onClick={handleDownloadSampleZip}
                disabled={isProcessing}
                className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Sample Certificate .ZIP (9 Pre-Matched MTCs)</span>
              </button>
            </div>

            {activeFileName && (
              <div className="mt-2 text-xs font-mono font-bold text-blue-800 bg-blue-100/70 py-1 px-3 rounded inline-block">
                Loaded: {activeFileName} ({extractedList.length} certificates extracted)
              </div>
            )}
          </div>

          {/* Extracted Certificates Review Table */}
          {extractedList.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <span className="font-bold text-slate-800 text-xs">
                    Extracted Certificates Review ({extractedList.length} files)
                  </span>
                  <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span className="text-emerald-700 font-bold flex items-center space-x-0.5">
                      <CheckCircle2 className="h-3 w-3 inline" />
                      <span>{matchedCount} Matched to Master Stock</span>
                    </span>
                    <span>&bull;</span>
                    <span className="text-amber-700 font-bold flex items-center space-x-0.5">
                      <AlertTriangle className="h-3 w-3 inline" />
                      <span>{unmatchedCount} Unmatched / Standalone</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCommitCertificates}
                  disabled={isCommitting}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2 rounded-lg shadow flex items-center space-x-1.5 transition-colors"
                >
                  <FileCheck2 className="h-4 w-4" />
                  <span>Commit {extractedList.length} Certificates to Database</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-2">Certificate File</th>
                      <th className="p-2">Size</th>
                      <th className="p-2">Detected Heat Number</th>
                      <th className="p-2">Matched Stock Item</th>
                      <th className="p-2">Match Status</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {extractedList.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-medium text-slate-800 flex items-center space-x-1.5">
                          <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span className="truncate max-w-[180px]" title={item.fileName}>{item.fileName}</span>
                        </td>
                        <td className="p-2 font-mono text-slate-500">{item.fileSizeKB} KB</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.heatNumber}
                            onChange={(e) => handleUpdateHeatNumber(item.id, e.target.value)}
                            className="font-mono font-bold text-red-700 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs w-28 focus:ring-1 focus:ring-blue-500"
                            placeholder="Heat #"
                          />
                        </td>
                        <td className="p-2 text-slate-700 max-w-xs truncate" title={item.matchedItemDescription || 'No stock lot matched yet'}>
                          {item.detectedItemCode ? (
                            <div>
                              <span className="font-mono font-bold text-slate-900">{item.detectedItemCode}</span>
                              <div className="text-[10px] text-slate-500 truncate">{item.matchedItemDescription}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No matching stock lot in inventory</span>
                          )}
                        </td>
                        <td className="p-2">
                          {item.matchStatus === 'matched' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 w-max">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Matched to Stock</span>
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 w-max">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Standalone Heat</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => onPreviewPDF?.(item.pdfBlobUrl, item.detectedItemCode || 'CERT', item.heatNumber)}
                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1 mx-auto hover:underline"
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>
            Supported archives: <strong>.ZIP</strong> containing PDF test certificates, or multi-select individual <strong>.PDF</strong> files.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
