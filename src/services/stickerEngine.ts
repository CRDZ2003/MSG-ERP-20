import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import * as XLSX from 'xlsx'

export interface StickerItem {
  sl_no: string | number
  client_po_item_no?: string
  description: string
  po_qty: string | number
  uom: string
  heat_number: string
  certificate_number: string
  make: string
  remarks_1?: string
  remarks_2?: string
  remarks?: string
  loc?: string
  location?: string
  supplier?: string
  po_number?: string
  client_name?: string
  transmittal_number?: string
}

export interface StickerDocumentData {
  client_name?: string
  po_number?: string
  msg_ref?: string
  items: StickerItem[]
}

// 58 mm x 39 mm in PostScript points (1 pt = 1/72 inch)
export const STICKER_WIDTH = 164.4094   // 58 mm
export const STICKER_HEIGHT = 110.5512  // 39 mm

export function parseLocFromRemarks(rem1?: string, rem2?: string): string {
  const candidates: string[] = []
  for (const r of [rem1, rem2]) {
    if (!r) continue
    const val = String(r).trim()
    if (!val || ['NONE', 'NAN', 'N/A', '-', ''].includes(val.toUpperCase())) continue

    const match = val.match(/(?:LOC|LOCATION)\s*[:=\-]\s*(.*)/i)
    const cleaned = match ? match[1].trim() : val
    if (cleaned && !candidates.some(c => c.toUpperCase() === cleaned.toUpperCase())) {
      candidates.push(cleaned)
    }
  }
  return candidates.length > 0 ? candidates.join(' / ') : 'LOCATION-1'
}

function wrapTextIntoLines(
  text: string,
  maxWidth: number,
  font: any,
  fontSize: number,
  maxLines: number = 3
): string[] {
  if (!text) return []
  const clean = text.replace(/[\r\n]+/g, ' ').trim()
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const w = font.widthOfTextAtSize(test, fontSize)
    if (w <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
      if (lines.length === maxLines - 1) {
        break
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current)
  }
  return lines
}

// Parse Excel file into StickerDocumentData (supports SUMMARY SHEET, Stores Summary, Client Summary)
export async function parseExcelForStickers(file: File | ArrayBuffer): Promise<StickerDocumentData> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { items: [] }

  const sheet = wb.Sheets[sheetName]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (!rows || rows.length === 0) return { items: [] }

  let clientName = ''
  let poNumber = ''
  let msgRef = ''

  // 1. Scan metadata rows 0 to 5
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const row = rows[r]
    if (!row) continue
    for (const cell of row) {
      if (!cell) continue
      const str = String(cell).trim()
      const clientMatch = str.match(/Client\s*:\s*(.*)/i)
      if (clientMatch && clientMatch[1]) clientName = clientMatch[1].trim()

      const poMatch = str.match(/PO\s*Number\s*:\s*(.*)/i)
      if (poMatch && poMatch[1]) poNumber = poMatch[1].trim()

      const refMatch = str.match(/MSG\s*Ref\s*:\s*(.*)/i)
      if (refMatch && refMatch[1]) msgRef = refMatch[1].trim()
    }
  }

  // 2. Locate header row dynamically
  let headerIdx = -1
  let headers: string[] = []
  for (let idx = 0; idx < Math.min(rows.length, 12); idx++) {
    const row = rows[idx]
    if (row && row.some(cell => {
      const c = String(cell).toUpperCase()
      return c.includes('DESCRIPTION') || c.includes('ITEM DESC') || c.includes('CLIENT PO ITEM')
    })) {
      headerIdx = idx
      headers = row.map(c => (c !== null && c !== undefined ? String(c).trim() : ''))
      break
    }
  }

  if (headerIdx === -1) {
    headerIdx = 0
    headers = (rows[0] || []).map(c => (c !== null && c !== undefined ? String(c).trim() : ''))
  }

  const findCol = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const cleanTarget = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      for (let i = 0; i < headers.length; i++) {
        const cleanH = headers[i].replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        if (cleanH.includes(cleanTarget) || cleanH === cleanTarget) {
          return i
        }
      }
    }
    return -1
  }

  const colCpo = findCol(['Item.CF.Client PO Item No', 'CLIENT PO ITEM NO', 'Client PO Item', 'Item.CF', 'POS #', 'ITEM NO'])
  const colSl = findCol(['SL NO', 'SLNO', 'S.NO', 'ITEM #', 'SERIAL'])
  const colDesc = findCol(['Item Desc', 'Description', 'Desc', 'Item Description'])
  const colPoQty = findCol(['QuantityOrdered', 'PO Qty', 'PO Quantity', 'Qty', 'Quantity'])
  const colUom = findCol(['Unit', 'UOM', 'EA'])
  const colHeat = findCol(['Heat Number', 'Heat No', 'Heat#', 'Heat'])
  const colCert = findCol(['Certificate Number', 'Certificate No', 'Cert No', 'MTC #', 'Cert'])
  const colMake = findCol(['Make', 'MAKE', 'Manufacturer', 'Brand', 'Origin'])
  const colRem1 = findCol(['Remarks', 'Remarks-1', 'Remarks 1', 'Location', 'LOC'])
  const colRem2 = findCol(['Remarks-2', 'Remarks 2', 'Remark2'])
  const colTrans = findCol(['BAPCO APPROVED TRANSMITTAL NUMBER', 'Transmittal Number', 'Transmittal', 'Transmittal No'])
  const colSupp = findCol(['Supplier Name', 'Supplier', 'Vendor'])

  const items: StickerItem[] = []

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every(c => c === null || String(c).trim() === '')) continue

    const getVal = (col: number): string => {
      if (col !== -1 && col < row.length && row[col] !== null && row[col] !== undefined) {
        return String(row[col]).trim()
      }
      return ''
    }

    const desc = getVal(colDesc)
    if (!desc || desc.toUpperCase().includes('TOTAL')) continue

    const cpoRaw = getVal(colCpo)
    const slRaw = getVal(colSl)
    const rem1 = getVal(colRem1)
    const rem2 = getVal(colRem2)
    const combinedRemarks = rem1 && rem2 ? `${rem1} | ${rem2}` : rem1 || rem2 || 'LOCATION-1'

    items.push({
      sl_no: slRaw || cpoRaw || items.length + 1,
      client_po_item_no: cpoRaw || slRaw || `${items.length + 1}`,
      description: desc,
      po_qty: getVal(colPoQty) || '1',
      uom: getVal(colUom) || 'Ea',
      heat_number: getVal(colHeat) || '-',
      certificate_number: getVal(colCert) || '-',
      make: getVal(colMake) || 'DELCORTE, FRANCE',
      remarks: combinedRemarks,
      loc: combinedRemarks,
      supplier: getVal(colSupp) || '',
      transmittal_number: getVal(colTrans) || 'TRA-STS-BAP-0157',
      po_number: poNumber,
      client_name: clientName,
    })
  }

  return {
    client_name: clientName,
    po_number: poNumber,
    msg_ref: msgRef,
    items,
  }
}

// Generate exact 58mm x 39mm landscape sticker PDF matching user layout 100%
export async function generateStickersPdf(
  input: StickerDocumentData | StickerItem[],
  options?: { client_name?: string; po_number?: string }
): Promise<Uint8Array> {
  const items = Array.isArray(input) ? input : input.items
  const globalClient = (!Array.isArray(input) ? input.client_name : options?.client_name) || 'STS Bahrain'
  const globalPo = (!Array.isArray(input) ? input.po_number : options?.po_number) || 'BSTSPO260300029-Location-1'

  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

  // Load logo
  let embeddedLogo: any = null
  try {
    const logoRes = await fetch('/logo.png').catch(() => fetch('/assets/logo.png'))
    if (logoRes && logoRes.ok) {
      const buf = await logoRes.arrayBuffer()
      embeddedLogo = await pdfDoc.embedPng(buf)
    }
  } catch (err) {
    console.warn('Could not load logo for stickers', err)
  }

  for (const item of items) {
    const page = pdfDoc.addPage([STICKER_WIDTH, STICKER_HEIGHT])
    const clientName = item.client_name || globalClient || 'STS Bahrain'
    const poNumber = item.po_number || globalPo || 'BSTSPO260300029-Location-1'
    const itemNo = item.client_po_item_no || item.sl_no || '1'
    const qtyStr = String(item.po_qty || '1')
    const uomStr = item.uom || 'Ea'
    const heatStr = item.heat_number || '-'
    const makeStr = item.make || 'DELCORTE, FRANCE'
    const certStr = item.certificate_number || '-'
    const remarksStr = item.remarks || item.location || 'LOCATION-1'

    // 1. Header (Left, Times-Bold 7.3 pt)
    page.drawText(clientName, {
      x: 5.67,
      y: 97.58,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`PO Number: ${poNumber}`, {
      x: 5.67,
      y: 89.19,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`ITEM NO: ${itemNo}`, {
      x: 5.67,
      y: 80.79,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // 2. Logo (Top Right: x=121.89, y=86.46, w=34.02, h=19.84)
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: 121.89,
        y: 86.46,
        width: 34.02,
        height: 19.84,
      })
    }

    // 3. Description (Wrapped into up to 3 lines, starting at y=69.48, deltaY=8.40)
    const maxWidth = 153.07
    const descLines = wrapTextIntoLines(item.description, maxWidth, fontBold, 7.3, 3)
    let yDesc = 69.48
    for (const dLine of descLines) {
      page.drawText(dLine, {
        x: 5.67,
        y: yDesc,
        size: 7.3,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      yDesc -= 8.40
    }

    // 4. Specifications (Times-Bold 7.3 pt)
    page.drawText(`PO QTY: ${qtyStr} ${uomStr}`, {
      x: 5.67,
      y: 40.64,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`HEAT NUMBER: ${heatStr}`, {
      x: 5.67,
      y: 32.25,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`MAKE: ${makeStr}`, {
      x: 5.67,
      y: 23.85,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`CERTIFICATE NO: ${certStr}`, {
      x: 5.67,
      y: 15.46,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    page.drawText(`Remarks: ${remarksStr}`, {
      x: 5.67,
      y: 7.06,
      size: 7.3,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // 5. QR Code (Bottom Right: x=138.90, y=5.67, w=17.01, h=17.01)
    try {
      const qrData = `ITEM:${itemNo}|PO:${poNumber}|HEAT:${heatStr}|MAKE:${makeStr}|QTY:${qtyStr} ${uomStr}`
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        margin: 0,
        width: 100,
        errorCorrectionLevel: 'M',
      })
      const qrBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer())
      const qrImg = await pdfDoc.embedPng(qrBytes)
      page.drawImage(qrImg, {
        x: 138.90,
        y: 5.67,
        width: 17.01,
        height: 17.01,
      })
    } catch (e) {
      console.warn('QR embed warning', e)
    }
  }

  return await pdfDoc.save()
}

// Helper to trigger browser download
export function downloadStickerPdfBlob(pdfBytes: Uint8Array, filename: string = 'stickers_msg_final.pdf'): void {
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => window.URL.revokeObjectURL(url), 2000)
}
