// Certificate Vault & Raw Byte Storage for MSG Oilfield Equipment Trading LLC
// Guarantees zero alteration, 100% byte-for-byte preservation of authentic supplier PDFs from ZIP files.

export interface StoredCertificateEntry {
  bytes: Uint8Array
  fileName: string
  mimeType: string
  url: string
  detectedHeat?: string
  extractedText?: string
}

export const uploadedCertificatesCache = new Map<string, StoredCertificateEntry>()

export function registerUploadedCertificate(
  nameOrHeat: string,
  bytes: Uint8Array,
  fileName: string,
  detectedHeat?: string,
  extractedText?: string
): string {
  const blob = new Blob([bytes as any], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const entry: StoredCertificateEntry = { bytes, fileName, mimeType: 'application/pdf', url, detectedHeat, extractedText }

  uploadedCertificatesCache.set(nameOrHeat.toLowerCase().trim(), entry)
  uploadedCertificatesCache.set(fileName.toLowerCase().trim(), entry)
  const cleanKey = nameOrHeat.replace(/\.[^/.]+$/, '').toLowerCase().trim()
  uploadedCertificatesCache.set(cleanKey, entry)
  if (detectedHeat) {
    uploadedCertificatesCache.set(detectedHeat.toLowerCase().trim(), entry)
  }
  return url
}

export function getUploadedCertificateBytes(refOrHeatOrDocName?: string): Uint8Array | null {
  if (!refOrHeatOrDocName) return null
  const key = refOrHeatOrDocName.toLowerCase().trim()
  const entry = uploadedCertificatesCache.get(key)
  if (entry) return entry.bytes

  const cleanKey = key.replace(/\.[^/.]+$/, '').trim()
  const cleanEntry = uploadedCertificatesCache.get(cleanKey)
  if (cleanEntry) return cleanEntry.bytes

  return null
}

export function getAllCachedCertificates(): StoredCertificateEntry[] {
  const unique = new Map<string, StoredCertificateEntry>()
  uploadedCertificatesCache.forEach((val) => {
    unique.set(val.fileName.toLowerCase(), val)
  })
  return Array.from(unique.values())
}

// Inspects ASCII and stream content inside raw PDF bytes to extract Heat Numbers and keywords
export function extractTextAndHeatsFromPDFBytes(
  bytes: Uint8Array,
  candidateHeats: string[] = []
): { detectedHeat?: string; textSnippet?: string } {
  let text = ''
  const maxBytes = Math.min(bytes.length, 600000)
  for (let i = 0; i < maxBytes; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      text += String.fromCharCode(b)
    }
  }

  // 1. Check known candidate heats from Excel
  for (const heat of candidateHeats) {
    const clean = heat.trim()
    if (clean && clean.length >= 2 && !clean.startsWith('LOT-')) {
      const escaped = clean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(`\\b${escaped}\\b`, 'i')
      if (regex.test(text)) {
        return { detectedHeat: clean, textSnippet: `Found Heat "${clean}" in PDF content` }
      }
    }
  }

  // 2. Regex patterns commonly found on Mill Test Certificates EN 10204 3.1
  const heatMatch = text.match(/(?:HEAT|HEAT\s*(?:NO|NUMBER|#)|CHARGE|CHARGE\s*(?:NO|#)|CAST\s*(?:NO|#))[\s:=-]+([A-Za-z0-9\-_/]{3,20})/i)
  if (heatMatch) {
    return { detectedHeat: heatMatch[1].trim(), textSnippet: heatMatch[0].trim() }
  }

  return {}
}
