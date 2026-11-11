import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'
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
}

// Extract and clean location from remarks exactly matching Python loc_labels_generator.py
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
  return candidates.length > 0 ? candidates.join(' / ') : 'LOC: NOT FOUND'
}

// Parse Excel file into StickerItem array (supports Stores Summary, Client Summary, and Master Inventory)
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
  const colPo = findCol(['PO Number', 'PO No', 'PO#', 'Customer PO', 'Purchase Order'])

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
    const locVal = parseLocFromRemarks(rem1, rem2)

    items.push({
      sl_no: slRaw || items.length + 1,
      client_po_item_no: getVal(colCpo) || slRaw || `${items.length + 1}`,
      description: desc,
      po_qty: getVal(colPoQty) || '1',
      uom: getVal(colUom) || 'PCS',
      heat_number: getVal(colHeat) || '-',
      certificate_number: getVal(colCert) || '-',
      make: getVal(colMake) || '-',
      remarks_1: rem1,
      remarks_2: rem2,
      remarks: rem1 || rem2 || '',
      loc: locVal,
      location: locVal,
      supplier: getVal(colSupp) || '-',
      po_number: getVal(colPo) || '-',
    })
  }

  // Sort strictly by SL NO number
  items.sort((a, b) => {
    const na = parseInt(String(a.sl_no).replace(/\D/g, ''), 10) || 0
    const nb = parseInt(String(b.sl_no).replace(/\D/g, ''), 10) || 0
    return na - nb
  })

  return items
}

// Fetch image buffer helper
async function tryFetchImageBuffer(paths: string[]): Promise<Uint8Array | null> {
  for (const p of paths) {
    try {
      const res = await fetch(p)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        return new Uint8Array(buf)
      }
    } catch {}
  }
  return null
}

function wrapLine(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let curLine = ''

  for (const w of words) {
    const test = curLine ? `${curLine} ${w}` : w
    const width = font.widthOfTextAtSize(test, fontSize)
    if (width <= maxWidth) {
      curLine = test
    } else {
      if (curLine) lines.push(curLine)
      curLine = w
    }
  }
  if (curLine) lines.push(curLine)
  return lines.length > 0 ? lines : ['-']
}

// Generate EXACT, Finalized Material Location Tags (2 per A4 Page) matching server/loc_labels_generator.py strictly
export async function generateStickersPdf(items: StickerItem[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Load Logo & Signature
  const logoBytes = await tryFetchImageBuffer(['/logo.png', '/assets/logo.png', '/assets/msg_logo.png'])
  let embeddedLogo: any = null
  if (logoBytes) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoBytes)
    } catch {
      try {
        embeddedLogo = await pdfDoc.embedJpg(logoBytes)
      } catch {}
    }
  }

  const sigBytes = await tryFetchImageBuffer(['/assets/signature.png', '/signature.png'])
  let embeddedSig: any = null
  if (sigBytes) {
    try {
      embeddedSig = await pdfDoc.embedPng(sigBytes)
    } catch {
      try {
        embeddedSig = await pdfDoc.embedJpg(sigBytes)
      } catch {}
    }
  }

  // Exact ReportLab A4 measurements from loc_labels_generator.py:
  // pagesize = A4 = [595.28, 841.89]
  // leftMargin = 14*mm = 39.68 pt, rightMargin = 39.68 pt
  // printable_w = 515.92 pt, tag_width = 515.92 pt
  // topMargin = 12*mm = 34.0 pt, bottomMargin = 34.0 pt
  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const TAG_WIDTH = 515.92
  const TAG_HEIGHT = 360
  const TAG_X = (PAGE_WIDTH - TAG_WIDTH) / 2 // 39.68 pt

  const TAG_TOP_Y = PAGE_HEIGHT - 34.0 // 807.89 pt (top edge of Tag 1)
  const TAG_BOTTOM_Y = 34.0 + TAG_HEIGHT // 394.0 pt (top edge of Tag 2)

  const drawExactTag = (page: PDFPage, item: StickerItem, topY: number) => {
    const bottomY = topY - TAG_HEIGHT

    // 1. Tag Outer Container (Primary Navy border #1E3A8A, 1.5 pt)
    page.drawRectangle({
      x: TAG_X,
      y: bottomY,
      width: TAG_WIDTH,
      height: TAG_HEIGHT,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.118, 0.227, 0.541), // #1E3A8A
      borderWidth: 1.5,
    })

    const innerW = TAG_WIDTH - 10 // 505.92 pt
    const innerX = TAG_X + 5

    // -------------------------------------------------------------
    // Section 1: Header (Height 38 pt)
    // -------------------------------------------------------------
    const headerTop = topY - 5
    const headerHeight = 38
    const headerBottom = headerTop - headerHeight

    // 1a. Logo Image (Left, maxW=125, maxH=34)
    if (embeddedLogo) {
      const aspect = embeddedLogo.width / embeddedLogo.height
      const logoH = 32
      const logoW = Math.min(logoH * aspect, 120)
      page.drawImage(embeddedLogo, {
        x: innerX + 4,
        y: headerBottom + (headerHeight - logoH) / 2,
        width: logoW,
        height: logoH,
      })
    }

    // 1b. Title (Center): MATERIAL LOCATION / LOC
    const titleText = 'MATERIAL LOCATION / LOC'
    const titleSize = 12.5
    const titleW = fontBold.widthOfTextAtSize(titleText, titleSize)
    page.drawText(titleText, {
      x: innerX + (innerW - titleW) / 2,
      y: headerBottom + 20,
      size: titleSize,
      font: fontBold,
      color: rgb(0.059, 0.090, 0.165), // #0F172A
    })

    const subTitleText = 'MSG OILFIELD SUPPLIES'
    const subTitleSize = 7.5
    const subTitleW = fontRegular.widthOfTextAtSize(subTitleText, subTitleSize)
    page.drawText(subTitleText, {
      x: innerX + (innerW - subTitleW) / 2,
      y: headerBottom + 8,
      size: subTitleSize,
      font: fontRegular,
      color: rgb(0.278, 0.333, 0.412), // #475569
    })

    // 1c. Ref Block (Right)
    const slNoStr = `SL NO: ${item.sl_no}`
    const slNoSize = 9.5
    const slNoW = fontBold.widthOfTextAtSize(slNoStr, slNoSize)
    page.drawText(slNoStr, {
      x: innerX + innerW - slNoW - 4,
      y: headerBottom + 20,
      size: slNoSize,
      font: fontBold,
      color: rgb(0.118, 0.161, 0.231), // #1E293B
    })

    const numOnly = String(item.sl_no).replace(/\D/g, '')
    const refCodeStr = `REF #${numOnly ? numOnly.padStart(4, '0') : String(item.sl_no)}`
    const refCodeSize = 7.0
    const refCodeW = fontRegular.widthOfTextAtSize(refCodeStr, refCodeSize)
    page.drawText(refCodeStr, {
      x: innerX + innerW - refCodeW - 4,
      y: headerBottom + 8,
      size: refCodeSize,
      font: fontRegular,
      color: rgb(0.392, 0.455, 0.545), // #64748B
    })

    // -------------------------------------------------------------
    // Section 2: LOC Display Box (Height 42 pt)
    // -------------------------------------------------------------
    const locBoxTop = headerBottom - 4
    const locBoxHeight = 42
    const locBoxBottom = locBoxTop - locBoxHeight

    const locVal = (item.loc || item.location || 'LOC: NOT FOUND').trim().toUpperCase()
    const isNotFound = locVal.includes('NOT FOUND')

    page.drawRectangle({
      x: innerX,
      y: locBoxBottom,
      width: innerW,
      height: locBoxHeight,
      color: isNotFound ? rgb(0.996, 0.949, 0.949) : rgb(0.973, 0.980, 0.988), // #FEF2F2 vs #F8FAFC
      borderColor: isNotFound ? rgb(0.988, 0.647, 0.647) : rgb(0.796, 0.835, 0.882), // #FCA5A5 vs #CBD5E1
      borderWidth: 1.0,
    })

    const locHdr = 'LOCATION / LOC'
    const locHdrSize = 8.5
    const locHdrW = fontBold.widthOfTextAtSize(locHdr, locHdrSize)
    page.drawText(locHdr, {
      x: innerX + (innerW - locHdrW) / 2,
      y: locBoxBottom + 26,
      size: locHdrSize,
      font: fontBold,
      color: isNotFound ? rgb(0.863, 0.149, 0.149) : rgb(0.278, 0.333, 0.412), // #DC2626 vs #475569
    })

    const locValSize = isNotFound ? 16.5 : 20.0
    const locValW = fontBold.widthOfTextAtSize(locVal, locValSize)
    page.drawText(locVal, {
      x: innerX + (innerW - locValW) / 2,
      y: locBoxBottom + 7,
      size: locValSize,
      font: fontBold,
      color: isNotFound ? rgb(0.863, 0.149, 0.149) : rgb(0.059, 0.090, 0.165), // #DC2626 vs #0F172A
    })

    // -------------------------------------------------------------
    // Section 3: Data Specification Table (4 rows, Total Height ~150 pt)
    // -------------------------------------------------------------
    const specTop = locBoxBottom - 6
    const rowH = 26
    const specTableHeight = rowH * 4
    const specTableBottom = specTop - specTableHeight

    const wL1 = 80
    const wV1 = (innerW - 160) / 2 // ~173 pt
    const wL2 = 80
    const wV2 = (innerW - 160) / 2 // ~173 pt

    const colX0 = innerX
    const colX1 = colX0 + wL1
    const colX2 = colX1 + wV1
    const colX3 = colX2 + wL2
    const colX4 = innerX + innerW

    const rowBgColors = [
      rgb(0.945, 0.961, 0.976), // Row 1: #F1F5F9
      rgb(1, 1, 1),             // Row 2: #FFFFFF
      rgb(0.973, 0.980, 0.988), // Row 3: #F8FAFC
      rgb(1, 1, 1),             // Row 4: #FFFFFF
    ]

    const specRows = [
      {
        l1: 'Description:',
        v1: item.description || '-',
        isBold1: true,
        l2: 'PO Number:',
        v2: item.po_number || '-',
        isBold2: true,
      },
      {
        l1: 'PO Qty & UOM:',
        v1: `${item.po_qty} ${item.uom}`.trim(),
        isBold1: false,
        l2: 'MAKE:',
        v2: item.make || '-',
        isBold2: false,
      },
      {
        l1: 'Heat Number:',
        v1: item.heat_number || '-',
        isBold1: true,
        l2: 'Certificate No:',
        v2: item.certificate_number || '-',
        isBold2: false,
      },
      {
        l1: 'Supplier:',
        v1: item.supplier || '-',
        isBold1: false,
        l2: 'Remarks (1 & 2):',
        v2: `${item.remarks_1 || item.remarks || '-'} | ${item.remarks_2 || '-'}`,
        isBold2: false,
      },
    ]

    // Outer grid border & row backgrounds
    for (let rIdx = 0; rIdx < 4; rIdx++) {
      const rY = specTop - (rIdx + 1) * rowH

      page.drawRectangle({
        x: innerX,
        y: rY,
        width: innerW,
        height: rowH,
        color: rowBgColors[rIdx],
        borderColor: rgb(0.886, 0.910, 0.941), // #E2E8F0
        borderWidth: 0.5,
      })

      // Vertical separators
      for (const sepX of [colX1, colX2, colX3]) {
        page.drawLine({
          start: { x: sepX, y: rY },
          end: { x: sepX, y: rY + rowH },
          color: rgb(0.886, 0.910, 0.941),
          thickness: 0.5,
        })
      }

      const rowData = specRows[rIdx]

      // Label 1
      page.drawText(rowData.l1, {
        x: colX0 + 5,
        y: rY + 8,
        size: 8,
        font: fontBold,
        color: rgb(0.200, 0.255, 0.333), // #334155
      })

      // Value 1 (wrapped if description)
      const val1Font = rowData.isBold1 ? fontBold : fontRegular
      const val1Lines = wrapLine(rowData.v1, wV1 - 8, val1Font, 8.5)
      if (val1Lines.length === 1) {
        page.drawText(val1Lines[0], {
          x: colX1 + 5,
          y: rY + 8,
          size: 8.5,
          font: val1Font,
          color: rgb(0.059, 0.090, 0.165), // #0F172A
        })
      } else {
        page.drawText(val1Lines[0], {
          x: colX1 + 5,
          y: rY + 14,
          size: 8,
          font: val1Font,
          color: rgb(0.059, 0.090, 0.165),
        })
        page.drawText(val1Lines[1], {
          x: colX1 + 5,
          y: rY + 4,
          size: 8,
          font: val1Font,
          color: rgb(0.059, 0.090, 0.165),
        })
      }

      // Label 2
      page.drawText(rowData.l2, {
        x: colX2 + 5,
        y: rY + 8,
        size: 8,
        font: fontBold,
        color: rgb(0.200, 0.255, 0.333), // #334155
      })

      // Value 2
      const val2Font = rowData.isBold2 ? fontBold : fontRegular
      const val2Lines = wrapLine(rowData.v2, wV2 - 8, val2Font, 8.5)
      page.drawText(val2Lines[0], {
        x: colX3 + 5,
        y: rY + 8,
        size: 8.5,
        font: val2Font,
        color: rgb(0.059, 0.090, 0.165),
      })
    }

    // -------------------------------------------------------------
    // Section 4: Authorized Signature Section (Height ~40 pt)
    // -------------------------------------------------------------
    const sigTop = specTableBottom - 6
    const sigHeight = 42
    const sigBottom = sigTop - sigHeight

    // Line above signature
    page.drawLine({
      start: { x: innerX, y: sigTop },
      end: { x: innerX + innerW, y: sigTop },
      color: rgb(0.796, 0.835, 0.882), // #CBD5E1
      thickness: 0.5,
    })

    // Col 1: Authorized Signature (x = innerX + 4, width 140)
    page.drawText('Authorized Signature', {
      x: innerX + 4,
      y: sigTop - 12,
      size: 8,
      font: fontBold,
      color: rgb(0.118, 0.161, 0.231), // #1E293B
    })

    if (embeddedSig) {
      const sigAspect = embeddedSig.width / embeddedSig.height
      const sH = 22
      const sW = Math.min(sH * sigAspect, 100)
      page.drawImage(embeddedSig, {
        x: innerX + 4,
        y: sigBottom + 4,
        width: sW,
        height: sH,
      })
    }

    // Col 2: Authorized By (x = innerX + 150)
    page.drawText('Authorized By: ____________________', {
      x: innerX + 150,
      y: sigTop - 24,
      size: 8,
      font: fontBold,
      color: rgb(0.200, 0.255, 0.333),
    })

    // Col 3: Date (x = innerX + 340)
    page.drawText('Date: ____________________', {
      x: innerX + 340,
      y: sigTop - 24,
      size: 8,
      font: fontBold,
      color: rgb(0.200, 0.255, 0.333),
    })
  }

  // Iterate items: 2 tags per A4 page exactly
  for (let i = 0; i < items.length; i += 2) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    // Top Tag
    const itemTop = items[i]
    drawExactTag(page, itemTop, TAG_TOP_Y)

    // Bottom Tag (if exists)
    if (i + 1 < items.length) {
      const itemBottom = items[i + 1]
      drawExactTag(page, itemBottom, TAG_BOTTOM_Y)
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
