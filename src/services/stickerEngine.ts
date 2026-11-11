import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

export interface StickerItem {
  sl_no: string | number
  client_po_item_no?: string
  description: string
  po_qty: string | number
  uom: string
  heat_number: string
  certificate_number: string
  make: string
  remarks?: string
  location?: string
  supplier?: string
  po_number?: string
}

export interface StickerOptions {
  font: 'Helvetica' | 'Times' | 'Courier'
  addLogo: boolean
  addQr: boolean
}

// Helper to extract LOC from remarks if formatted like "LOC: BB10" or "Stock BB10"
export function extractLocationFromRemarks(rem1?: string, rem2?: string): string {
  const candidates: string[] = []
  for (const r of [rem1, rem2]) {
    if (!r) continue
    const val = String(r).trim()
    if (!val || ['NONE', 'NAN', 'N/A', '-', ''].includes(val.toUpperCase())) continue

    const match = val.match(/(?:LOC|LOCATION)\s*[:=\-]\s*(.*)/i)
    const cleaned = match ? match[1].trim() : val
    if (cleaned && !candidates.includes(cleaned)) {
      candidates.push(cleaned)
    }
  }
  return candidates.length > 0 ? candidates.join(' / ') : 'WAREHOUSE STOCK'
}

// Parse Excel file into StickerItem array
export async function parseExcelForStickers(file: File | ArrayBuffer): Promise<StickerItem[]> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []

  const sheet = wb.Sheets[sheetName]
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  if (!rows || rows.length === 0) return []

  // Locate header row dynamically
  let headerIdx = 0
  let headers: string[] = []
  for (let idx = 0; idx < Math.min(rows.length, 12); idx++) {
    const row = rows[idx]
    if (row && row.some(cell => String(cell).toUpperCase().includes('DESCRIPTION'))) {
      headerIdx = idx
      headers = row.map(c => (c !== null && c !== undefined ? String(c).trim() : ''))
      break
    }
  }

  if (headers.length === 0 && rows.length > 0) {
    headers = rows[0].map(c => (c !== null && c !== undefined ? String(c).trim() : ''))
    headerIdx = 0
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

  const colSl = findCol(['SL NO', 'SLNO', 'SL.NO', 'S.NO', 'SERIAL', 'NO', 'ITEM #'])
  const colCpo = findCol(['CLIENT PO ITEM NO', 'CLIENT PO ITEM', 'CLIENT ITEM', 'POS #', 'ITEM CODE'])
  const colDesc = findCol(['Description', 'Desc', 'Item Description'])
  const colPoQty = findCol(['PO Qty', 'PO Quantity', 'Qty', 'Quantity'])
  const colUom = findCol(['UOM', 'Unit'])
  const colHeat = findCol(['Heat Number', 'Heat No', 'Heat#', 'Heat'])
  const colCert = findCol(['Certificate Number', 'Certificate No', 'Cert No', 'MTC #'])
  const colMake = findCol(['MAKE', 'Manufacturer', 'Brand', 'Origin'])
  const colRem1 = findCol(['Remarks-1', 'Remarks 1', 'Remark1', 'Remarks'])
  const colRem2 = findCol(['Remarks-2', 'Remarks 2', 'Remark2', 'Location'])
  const colSupp = findCol(['Supplier Name', 'Supplier', 'Vendor'])
  const colPo = findCol(['PO Number', 'PO No', 'PO#', 'Customer PO'])

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

    const slRaw = getVal(colSl)
    const rem1 = getVal(colRem1)
    const rem2 = getVal(colRem2)
    const loc = extractLocationFromRemarks(rem1, rem2)

    items.push({
      sl_no: slRaw || items.length + 1,
      client_po_item_no: getVal(colCpo) || slRaw || `${items.length + 1}`,
      description: desc,
      po_qty: getVal(colPoQty) || '1',
      uom: getVal(colUom) || 'PCS',
      heat_number: getVal(colHeat) || '-',
      certificate_number: getVal(colCert) || '-',
      make: getVal(colMake) || 'MSG APPROVED MILL',
      remarks: rem1 || rem2 || '',
      location: loc,
      supplier: getVal(colSupp) || '',
      po_number: getVal(colPo) || '',
    })
  }

  return items
}

// Fetch logo array buffer
async function fetchStickerLogoBuffer(): Promise<ArrayBuffer | null> {
  const paths = ['/logo.png', '/assets/logo.png', '/assets/msg_logo.png']
  for (const p of paths) {
    try {
      const res = await fetch(p)
      if (res.ok) return await res.arrayBuffer()
    } catch {}
  }
  return null
}

// Generate Print-Ready Stickers PDF (2 stickers per A4 page)
export async function generateStickersPdf(
  items: StickerItem[],
  options: StickerOptions = { font: 'Helvetica', addLogo: true, addQr: true }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  // Select fonts
  let fontBold: any
  let fontRegular: any
  if (options.font === 'Times') {
    fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
    fontRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  } else if (options.font === 'Courier') {
    fontBold = await pdfDoc.embedFont(StandardFonts.CourierBold)
    fontRegular = await pdfDoc.embedFont(StandardFonts.Courier)
  } else {
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  // Pre-fetch Logo
  let embeddedLogo: any = null
  if (options.addLogo) {
    const logoBuf = await fetchStickerLogoBuffer()
    if (logoBuf) {
      try {
        embeddedLogo = await pdfDoc.embedPng(logoBuf)
      } catch {
        try {
          embeddedLogo = await pdfDoc.embedJpg(logoBuf)
        } catch {}
      }
    }
  }

  // A4 dimensions: 595.28 x 841.89
  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89

  const STICKER_WIDTH = 547
  const STICKER_HEIGHT = 385
  const STICKER_X = (PAGE_WIDTH - STICKER_WIDTH) / 2 // 24.14 pt

  // Top sticker Y = 432, Bottom sticker Y = 25
  const STICKER_Y_TOP = 432
  const STICKER_Y_BOTTOM = 25

  const drawSticker = async (page: PDFPage, item: StickerItem, startY: number) => {
    // Outer Border & Card
    page.drawRectangle({
      x: STICKER_X,
      y: startY,
      width: STICKER_WIDTH,
      height: STICKER_HEIGHT,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.12, 0.16, 0.24),
      borderWidth: 1.5,
    })

    // Header Banner (Navy)
    const headerHeight = 52
    const headerY = startY + STICKER_HEIGHT - headerHeight
    page.drawRectangle({
      x: STICKER_X,
      y: headerY,
      width: STICKER_WIDTH,
      height: headerHeight,
      color: rgb(0.06, 0.11, 0.22),
    })

    // Logo / Company Title
    let titleStartX = STICKER_X + 16
    if (options.addLogo && embeddedLogo) {
      const logoAspect = embeddedLogo.width / embeddedLogo.height
      const logoH = 34
      const logoW = Math.min(logoH * logoAspect, 90)
      page.drawImage(embeddedLogo, {
        x: STICKER_X + 14,
        y: headerY + (headerHeight - logoH) / 2,
        width: logoW,
        height: logoH,
      })
      titleStartX += logoW + 12
    }

    page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
      x: titleStartX,
      y: headerY + 28,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText('DUBAI INDUSTRIAL CITY, UAE  |  MATERIAL IDENTIFICATION & TRACEABILITY TAG', {
      x: titleStartX,
      y: headerY + 12,
      size: 7.5,
      font: fontBold,
      color: rgb(0.95, 0.65, 0.25),
    })

    // Content Coordinates
    const contentTopY = headerY - 14
    const leftColX = STICKER_X + 16
    const rightColX = STICKER_X + STICKER_WIDTH - 150

    // Top Meta Row: SL NO, CLIENT PO ITEM NO, PO #
    page.drawText(`ITEM / POS #: ${item.sl_no}`, {
      x: leftColX,
      y: contentTopY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })

    if (item.client_po_item_no && item.client_po_item_no !== String(item.sl_no)) {
      page.drawText(`CLIENT REF: ${item.client_po_item_no}`, {
        x: leftColX + 130,
        y: contentTopY,
        size: 9,
        font: fontRegular,
        color: rgb(0.2, 0.25, 0.35),
      })
    }

    if (item.po_number) {
      page.drawText(`PO #: ${item.po_number}`, {
        x: leftColX + 260,
        y: contentTopY,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.3, 0.6),
      })
    }

    // Horizontal Divider
    page.drawLine({
      start: { x: leftColX, y: contentTopY - 8 },
      end: { x: rightColX - 10, y: contentTopY - 8 },
      color: rgb(0.85, 0.88, 0.92),
      thickness: 1,
    })

    // Description Section
    const descY = contentTopY - 24
    page.drawText('MATERIAL DESCRIPTION & SPECIFICATION:', {
      x: leftColX,
      y: descY,
      size: 7.5,
      font: fontBold,
      color: rgb(0.4, 0.45, 0.5),
    })

    // Split long description across multiple lines (max ~52 chars per line)
    const descText = item.description || '-'
    const words = descText.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const w of words) {
      if ((currentLine + ' ' + w).trim().length <= 50) {
        currentLine = (currentLine + ' ' + w).trim()
      } else {
        lines.push(currentLine)
        currentLine = w
      }
    }
    if (currentLine) lines.push(currentLine)

    const renderedLines = lines.slice(0, 3)
    renderedLines.forEach((l, lIdx) => {
      page.drawText(l, {
        x: leftColX,
        y: descY - 14 - lIdx * 13,
        size: 9.5,
        font: fontBold,
        color: rgb(0.08, 0.1, 0.15),
      })
    })

    // Critical Heat Number Block (Highlighted in prominent box)
    const heatBoxY = descY - 60
    const heatBoxWidth = rightColX - leftColX - 10
    const heatBoxHeight = 38

    page.drawRectangle({
      x: leftColX,
      y: heatBoxY,
      width: heatBoxWidth,
      height: heatBoxHeight,
      color: rgb(0.99, 0.94, 0.94),
      borderColor: rgb(0.85, 0.15, 0.15),
      borderWidth: 1.5,
    })

    page.drawText('HEAT NUMBER:', {
      x: leftColX + 10,
      y: heatBoxY + 23,
      size: 7.5,
      font: fontBold,
      color: rgb(0.65, 0.1, 0.1),
    })

    page.drawText(String(item.heat_number || 'REQUIRED').toUpperCase(), {
      x: leftColX + 10,
      y: heatBoxY + 8,
      size: 13,
      font: fontBold,
      color: rgb(0.75, 0.05, 0.05),
    })

    page.drawText('CERTIFICATE / MTC #:', {
      x: leftColX + 200,
      y: heatBoxY + 23,
      size: 7.5,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.4),
    })

    const certStr = String(item.certificate_number || '-').slice(0, 24)
    page.drawText(certStr, {
      x: leftColX + 200,
      y: heatBoxY + 8,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.15, 0.25),
    })

    // Qty, UOM, and Make Row
    const qtyRowY = heatBoxY - 26
    page.drawText(`QUANTITY: ${item.po_qty} ${item.uom || 'PCS'}`, {
      x: leftColX,
      y: qtyRowY,
      size: 11,
      font: fontBold,
      color: rgb(0.05, 0.15, 0.35),
    })

    page.drawText(`MAKE: ${item.make || 'BENKAN THAILAND'}`, {
      x: leftColX + 160,
      y: qtyRowY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.15, 0.2, 0.25),
    })

    // Storage Location Box (Highlighted in Amber)
    const locBoxY = qtyRowY - 42
    const locBoxHeight = 32
    page.drawRectangle({
      x: leftColX,
      y: locBoxY,
      width: heatBoxWidth,
      height: locBoxHeight,
      color: rgb(1, 0.98, 0.92),
      borderColor: rgb(0.9, 0.6, 0.1),
      borderWidth: 1.2,
    })

    page.drawText('WAREHOUSE LOCATION / REMARKS:', {
      x: leftColX + 10,
      y: locBoxY + 18,
      size: 7,
      font: fontBold,
      color: rgb(0.65, 0.4, 0.05),
    })

    const locText = item.location || item.remarks || 'WAREHOUSE STOCK'
    page.drawText(locText.slice(0, 48), {
      x: leftColX + 10,
      y: locBoxY + 6,
      size: 10.5,
      font: fontBold,
      color: rgb(0.7, 0.35, 0.0),
    })

    // Bottom Verification Bar
    const footerY = startY + 10
    page.drawText('All material subject to EN 10204 3.1 inspection. Do not dispatch without QA/QC verification.', {
      x: leftColX,
      y: footerY,
      size: 6.8,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.55),
    })

    // Right Column: QR Code OR QA/QC Verification Block
    if (options.addQr) {
      try {
        const qrPayload = JSON.stringify({
          co: 'MSG Oilfield',
          item: item.sl_no,
          heat: item.heat_number,
          cert: item.certificate_number,
          desc: item.description.slice(0, 40),
          qty: `${item.po_qty} ${item.uom}`,
          make: item.make,
          loc: item.location || item.remarks || '',
        })

        const qrDataUrl = await QRCode.toDataURL(qrPayload, {
          margin: 1,
          width: 250,
          errorCorrectionLevel: 'M',
        })

        const qrImageBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer())
        const qrPdfImage = await pdfDoc.embedPng(qrImageBytes)

        const qrSize = 120
        const qrX = rightColX + 5
        const qrY = heatBoxY - 25

        page.drawImage(qrPdfImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        })

        page.drawRectangle({
          x: qrX,
          y: qrY - 22,
          width: qrSize,
          height: 18,
          color: rgb(0.06, 0.11, 0.22),
          borderColor: rgb(0.06, 0.11, 0.22),
          borderWidth: 1,
        })

        page.drawText('SCAN TRACEABILITY', {
          x: qrX + 12,
          y: qrY - 16,
          size: 7,
          font: fontBold,
          color: rgb(1, 1, 1),
        })
      } catch (err) {
        console.warn('QR generation error for item', item.sl_no, err)
      }
    } else {
      // Inspection Sign-Off Block
      const inspectBoxY = heatBoxY - 45
      const inspectBoxW = 125
      const inspectBoxH = 140

      page.drawRectangle({
        x: rightColX + 5,
        y: inspectBoxY,
        width: inspectBoxW,
        height: inspectBoxH,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.2, 0.35, 0.6),
        borderWidth: 1,
      })

      page.drawText('QA/QC INSPECTION', {
        x: rightColX + 16,
        y: inspectBoxY + inspectBoxH - 18,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.4),
      })

      page.drawLine({
        start: { x: rightColX + 5, y: inspectBoxY + inspectBoxH - 24 },
        end: { x: rightColX + 5 + inspectBoxW, y: inspectBoxY + inspectBoxH - 24 },
        color: rgb(0.2, 0.35, 0.6),
        thickness: 0.8,
      })

      page.drawText('STATUS: [X] VERIFIED', {
        x: rightColX + 12,
        y: inspectBoxY + inspectBoxH - 42,
        size: 7.5,
        font: fontBold,
        color: rgb(0.1, 0.5, 0.2),
      })

      page.drawText('INSPECTED BY:', {
        x: rightColX + 12,
        y: inspectBoxY + 68,
        size: 7,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      })
      page.drawLine({
        start: { x: rightColX + 12, y: inspectBoxY + 54 },
        end: { x: rightColX + 118, y: inspectBoxY + 54 },
        color: rgb(0.6, 0.65, 0.7),
        thickness: 0.8,
      })

      page.drawText('DATE / STAMP:', {
        x: rightColX + 12,
        y: inspectBoxY + 36,
        size: 7,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      })
      page.drawLine({
        start: { x: rightColX + 12, y: inspectBoxY + 22 },
        end: { x: rightColX + 118, y: inspectBoxY + 22 },
        color: rgb(0.6, 0.65, 0.7),
        thickness: 0.8,
      })
    }
  }

  // Iterate items: 2 stickers per A4 page
  for (let i = 0; i < items.length; i += 2) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Top Sticker
    const itemTop = items[i]
    await drawSticker(page, itemTop, STICKER_Y_TOP)

    // Bottom Sticker (if exists)
    if (i + 1 < items.length) {
      const itemBottom = items[i + 1]
      await drawSticker(page, itemBottom, STICKER_Y_BOTTOM)
    }
  }

  return await pdfDoc.save()
}

// Download PDF helper
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
