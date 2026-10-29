import JSZip from 'jszip'
import { db } from './db'
import {
  uploadedCertificatesCache,
  registerUploadedCertificate,
  getUploadedCertificateBytes,
  getAllCachedCertificates,
  extractTextAndHeatsFromPDFBytes,
  StoredCertificateEntry
} from './certificateVault'

export {
  uploadedCertificatesCache,
  registerUploadedCertificate,
  getUploadedCertificateBytes,
  getAllCachedCertificates,
  extractTextAndHeatsFromPDFBytes
}
export type { StoredCertificateEntry }

export interface ExtractedCertificate {
  id: string
  fileName: string
  fileSizeKB: number
  heatNumber: string
  detectedItemCode?: string
  matchedLotId?: string
  matchedItemDescription?: string
  matchStatus: 'matched' | 'unmatched'
  pdfBlobUrl: string
  rawBytes: Uint8Array
  supplierName?: string
  purchaseType?: 'regular' | 'local_purchase'
  lCode?: string
  textSnippet?: string
}

// Cleans filename and detects Heat Number
export function detectHeatNumberFromFilename(fileName: string): string {
  // 1. Remove extension
  let clean = fileName.replace(/\.[^/.]+$/, '').trim()

  // 2. Strip common prefixes like MTC_, MTC-, HEAT_, HEAT-, CERT_, CERT-, EN10204_, MILL_CERT_
  clean = clean.replace(/^(?:MTC|HEAT|CERT|CERTIFICATE|EN10204|MILL|MILL_CERT|SUPPLIER_MTC)[\s_\-\:]+/i, '')

  // 3. Strip trailing suffixes like _3.1, _EN10204, _SIGNED, _STAMPED
  clean = clean.replace(/[\s_\-]+(?:3\.1|EN10204|SIGNED|STAMPED|APPROVED|FINAL|VERIFIED)$/i, '')

  return clean.trim()
}

// Process a .zip archive containing certificates
export async function extractCertificatesFromZip(
  zipFile: File,
  candidateHeats: string[] = []
): Promise<ExtractedCertificate[]> {
  const zip = new JSZip()
  const loadedZip = await zip.loadAsync(zipFile)
  const masterStock = db.getMasterStockView()
  const results: ExtractedCertificate[] = []

  const filePromises: Promise<void>[] = []

  loadedZip.forEach((relativePath, zipEntry) => {
    // Ignore folders and non-PDF files (e.g. __MACOSX, .DS_Store)
    if (zipEntry.dir || relativePath.startsWith('__MACOSX') || !relativePath.toLowerCase().endsWith('.pdf')) {
      return
    }

    const p = (async () => {
      const fileName = relativePath.split('/').pop() || relativePath
      const fileData = await zipEntry.async('uint8array')

      // Detect Heat from filename
      let detectedHeat = detectHeatNumberFromFilename(fileName)

      // Inspect text and content stream inside PDF bytes
      const inspection = extractTextAndHeatsFromPDFBytes(fileData, candidateHeats)
      if (inspection.detectedHeat && (!detectedHeat || detectedHeat.length < 2)) {
        detectedHeat = inspection.detectedHeat
      }

      // Store in memory cache to preserve original format byte-for-byte
      const blobUrl = registerUploadedCertificate(
        fileName,
        fileData,
        fileName,
        detectedHeat,
        inspection.textSnippet
      )

      // Try exact or fuzzy match with master stock
      const matchedLot = masterStock.find(s => {
        const h1 = s.heat_number.trim().toUpperCase()
        const h2 = detectedHeat.trim().toUpperCase()
        return h1 === h2 || (h2.length >= 3 && h1.includes(h2)) || (h1.length >= 3 && h2.includes(h1))
      })

      results.push({
        id: 'EXT-' + Math.random().toString(36).substring(2, 9),
        fileName,
        fileSizeKB: Math.round(fileData.length / 1024),
        heatNumber: matchedLot ? matchedLot.heat_number : (detectedHeat || 'UNMATCHED'),
        detectedItemCode: matchedLot?.item_code,
        matchedLotId: matchedLot?.id,
        matchedItemDescription: matchedLot?.item_description,
        matchStatus: matchedLot ? 'matched' : 'unmatched',
        pdfBlobUrl: blobUrl,
        rawBytes: fileData,
        supplierName: matchedLot?.supplier_name,
        purchaseType: matchedLot?.purchase_type,
        lCode: matchedLot?.l_code,
        textSnippet: inspection.textSnippet
      })
    })()

    filePromises.push(p)
  })

  await Promise.all(filePromises)

  // Sort matched first, then by heat number
  results.sort((a, b) => {
    if (a.matchStatus !== b.matchStatus) {
      return a.matchStatus === 'matched' ? -1 : 1
    }
    return a.heatNumber.localeCompare(b.heatNumber)
  })

  return results
}

// Process multiple selected .pdf files
export async function extractCertificatesFromPDFFiles(
  files: FileList | File[],
  candidateHeats: string[] = []
): Promise<ExtractedCertificate[]> {
  const masterStock = db.getMasterStockView()
  const results: ExtractedCertificate[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file.name.toLowerCase().endsWith('.pdf')) continue

    const arrayBuf = await file.arrayBuffer()
    const fileData = new Uint8Array(arrayBuf)

    let detectedHeat = detectHeatNumberFromFilename(file.name)
    const inspection = extractTextAndHeatsFromPDFBytes(fileData, candidateHeats)
    if (inspection.detectedHeat && (!detectedHeat || detectedHeat.length < 2)) {
      detectedHeat = inspection.detectedHeat
    }

    const blobUrl = registerUploadedCertificate(
      file.name,
      fileData,
      file.name,
      detectedHeat,
      inspection.textSnippet
    )

    const matchedLot = masterStock.find(s => {
      const h1 = s.heat_number.trim().toUpperCase()
      const h2 = detectedHeat.trim().toUpperCase()
      return h1 === h2 || (h2.length >= 3 && h1.includes(h2)) || (h1.length >= 3 && h2.includes(h1))
    })

    results.push({
      id: 'EXT-' + Math.random().toString(36).substring(2, 9),
      fileName: file.name,
      fileSizeKB: Math.round(fileData.length / 1024),
      heatNumber: matchedLot ? matchedLot.heat_number : (detectedHeat || 'UNMATCHED'),
      detectedItemCode: matchedLot?.item_code,
      matchedLotId: matchedLot?.id,
      matchedItemDescription: matchedLot?.item_description,
      matchStatus: matchedLot ? 'matched' : 'unmatched',
      pdfBlobUrl: blobUrl,
      rawBytes: fileData,
      supplierName: matchedLot?.supplier_name,
      purchaseType: matchedLot?.purchase_type,
      lCode: matchedLot?.l_code,
      textSnippet: inspection.textSnippet
    })
  }

  results.sort((a, b) => {
    if (a.matchStatus !== b.matchStatus) {
      return a.matchStatus === 'matched' ? -1 : 1
    }
    return a.heatNumber.localeCompare(b.heatNumber)
  })

  return results
}
