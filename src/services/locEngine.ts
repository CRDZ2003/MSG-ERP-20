// Letter of Compliance (LOC) & Material Identification Tags Engine
// Replicates and enhances all capabilities from msgee1 into MSG ERP
import * as XLSX from 'xlsx'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface LOCMetadata {
  date: string
  to_client: string
  po_number: string
  msg_ref: string
  signatory_name: string
  signatory_title: string
  action_type: 'fabricated' | 'machined' | 'modified' | 'tested' | 'certified' | string
  custom_declaration?: string
}

export interface LOCItem {
  sl_no: string | number
  description: string
  po_qty: number | string
  uom: string
  heat_number: string
  remarks: string
  cert_number?: string
  make?: string
  location?: string
  supplier?: string
  supplier_po?: string
}

export interface LOCDraft {
  id: string
  timestamp: string
  metadata: LOCMetadata
  items: LOCItem[]
}

// -------------------------------------------------------------
// Excel Summary Sheet Parser for LOC
// -------------------------------------------------------------
export async function parseExcelForLOC(file: File): Promise<{ metadata: LOCMetadata; items: LOCItem[] }> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const metadata: LOCMetadata = {
    date: new Date().toLocaleDateString('en-GB'), // DD/MM/YYYY
    to_client: '',
    po_number: '',
    msg_ref: '',
    signatory_name: 'Vijay Dsouza',
    signatory_title: '( QA / QC Dept )',
    action_type: 'fabricated',
  }

  // Extract metadata from the first 15 header rows
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const rowStr = rawRows[i].join(' ')
    const clientMatch = rowStr.match(/(?:CLIENT|TO)\s*[:=\-]\s*([^,\n\r]+)/i)
    if (clientMatch && !metadata.to_client) metadata.to_client = clientMatch[1].trim()

    const poMatch = rowStr.match(/(?:PO\s*NUMBER|PO\s*NO|PO#)\s*[:=\-]\s*([^,\n\r]+)/i)
    if (poMatch && !metadata.po_number) metadata.po_number = poMatch[1].trim()

    const refMatch = rowStr.match(/(?:MSG\s*REF|REF\s*NO|REF#)\s*[:=\-]\s*([^,\n\r]+)/i)
    if (refMatch && !metadata.msg_ref) metadata.msg_ref = refMatch[1].trim()

    const dateMatch = rowStr.match(/(?:DATE)\s*[:=\-]\s*([^,\n\r]+)/i)
    if (dateMatch && dateMatch[1].trim()) metadata.date = dateMatch[1].trim()
  }

  // Find table header row
  let headerIdx = -1
  let headers: string[] = []
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const row = rawRows[i].map(c => String(c).toUpperCase().trim())
    if (row.some(c => c.includes('DESCRIPTION') || c.includes('DESC') || c.includes('SL NO') || c.includes('SL.NO'))) {
      headerIdx = i
      headers = rawRows[i].map(c => String(c).trim())
      break
    }
  }

  if (headerIdx === -1 && rawRows.length > 0) {
    headerIdx = 0
    headers = rawRows[0].map(c => String(c).trim())
  }

  const findCol = (candidates: string[]): number => {
    for (const cand of candidates) {
      const cleanTarget = cand.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      for (let i = 0; i < headers.length; i++) {
        const cleanH = headers[i].replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        if (cleanH === cleanTarget || cleanH.includes(cleanTarget)) return i
      }
    }
    return -1
  }

  const colSl = findCol(['SL NO', 'SL.NO', 'S.NO', 'SLNO', 'SERIAL', 'ITEM NO'])
  const colDesc = findCol(['DESCRIPTION', 'ITEM DESCRIPTION', 'DESC'])
  const colQty = findCol(['PO QTY', 'PO QUANTITY', 'QTY', 'QUANTITY'])
  const colUom = findCol(['UOM', 'UNIT'])
  const colHeat = findCol(['HEAT NUMBER', 'HEAT NO', 'HEAT#'])
  const colCert = findCol(['CERTIFICATE NUMBER', 'CERTIFICATE NO', 'CERT NO', 'MTC'])
  const colMake = findCol(['MAKE', 'MANUFACTURER', 'BRAND'])
  const colRem1 = findCol(['REMARKS-1', 'REMARKS 1', 'REMARK1', 'REMARKS'])
  const colRem2 = findCol(['REMARKS-2', 'REMARKS 2', 'REMARK2'])
  const colSupp = findCol(['SUPPLIER', 'VENDOR'])
  const colPO = findCol(['PO NUMBER', 'PO NO', 'PO#'])

  const items: LOCItem[] = []
  let detectedAction: string | null = null

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i]
    if (!r || r.every(cell => !cell || String(cell).trim() === '')) continue

    const getVal = (col: number) => (col >= 0 && col < r.length && r[col] !== undefined ? String(r[col]).trim() : '')

    const sl_no = getVal(colSl) || String(items.length + 1)
    const description = getVal(colDesc)
    if (!description) continue

    const po_qty = getVal(colQty) || '1'
    const uom = getVal(colUom) || 'PCS'
    const heat_number = getVal(colHeat) || 'N/A'
    const cert_number = getVal(colCert)
    const make = getVal(colMake)
    const supplier = getVal(colSupp)
    const supplier_po = getVal(colPO)

    const rem1 = getVal(colRem1)
    const rem2 = getVal(colRem2)
    const combinedRemarks = [rem1, rem2].filter(Boolean).join(' | ')

    // Detect action wording
    const remLower = combinedRemarks.toLowerCase()
    if (remLower.includes('machin') || remLower.includes('bore') || remLower.includes('thread')) {
      detectedAction = 'machined'
    } else if (remLower.includes('modif') || remLower.includes('bevel') || remLower.includes('cut')) {
      detectedAction = 'modified'
    } else if (remLower.includes('fabricat') || remLower.includes('weld')) {
      detectedAction = 'fabricated'
    }

    // Extract location if present in remarks
    let location = ''
    const locMatch = combinedRemarks.match(/(?:LOC|LOCATION)\s*[:=\-]\s*([^|;\n\r]+)/i)
    if (locMatch) {
      location = locMatch[1].trim()
    }

    items.push({
      sl_no,
      description,
      po_qty,
      uom,
      heat_number,
      remarks: combinedRemarks,
      cert_number,
      make,
      location,
      supplier,
      supplier_po,
    })
  }

  if (detectedAction) {
    metadata.action_type = detectedAction
  }

  return { metadata, items }
}

// -------------------------------------------------------------
// Helper: Action Wording Builder
// -------------------------------------------------------------
export function buildComplianceWording(actionType: string): { verb: string; noun: string } {
  const act = (actionType || 'fabricated').toLowerCase()
  if (act.includes('machin')) {
    return { verb: 'machined', noun: 'machining' }
  } else if (act.includes('modif')) {
    return { verb: 'modified', noun: 'modification' }
  } else if (act.includes('test')) {
    return { verb: 'tested / inspected', noun: 'testing and inspection' }
  } else if (act.includes('certif')) {
    return { verb: 'verified & certified', noun: 'verification' }
  } else {
    return { verb: 'fabricated', noun: 'fabrication' }
  }
}

// -------------------------------------------------------------
// Helper: Load Image as bytes from URL or file
// -------------------------------------------------------------
async function tryFetchImageBytes(path: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(path)
    if (res.ok) {
      const buffer = await res.arrayBuffer()
      return new Uint8Array(buffer)
    }
  } catch (_e) {
    // ignore
  }
  return null
}

// -------------------------------------------------------------
// PDF Generator: Letter of Compliance (LOC)
// -------------------------------------------------------------
export async function generateLOCPdf(
  metadata: LOCMetadata,
  items: LOCItem[],
  options: {
    includeSignature?: boolean
    includeStamp?: boolean
    customSignatureDataUrl?: string
    customStampDataUrl?: string
  } = {}
): Promise<Uint8Array> {
  const { includeSignature = true, includeStamp = true } = options
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // A4 Dimensions: 595.28 x 841.89 points
  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginX = 40
  const contentWidth = pageWidth - marginX * 2 // 515.28

  // Try loading letterhead images from /assets/
  const headerBytes = await tryFetchImageBytes('/assets/msg_header.png')
  const footerBytes = await tryFetchImageBytes('/assets/msg_footer.png')
  const stampBytes = options.customStampDataUrl
    ? dataUrlToBytes(options.customStampDataUrl)
    : await tryFetchImageBytes('/assets/stamp.png')
  const sigBytes = options.customSignatureDataUrl
    ? dataUrlToBytes(options.customSignatureDataUrl)
    : await tryFetchImageBytes('/assets/signature.png')

  let embeddedHeaderImg: any = null
  let embeddedFooterImg: any = null
  let embeddedStampImg: any = null
  let embeddedSigImg: any = null

  try {
    if (headerBytes) embeddedHeaderImg = await pdfDoc.embedPng(headerBytes)
  } catch (_) {}
  try {
    if (footerBytes) embeddedFooterImg = await pdfDoc.embedPng(footerBytes)
  } catch (_) {}
  try {
    if (includeStamp && stampBytes) embeddedStampImg = await pdfDoc.embedPng(stampBytes)
  } catch (_) {}
  try {
    if (includeSignature && sigBytes) embeddedSigImg = await pdfDoc.embedPng(sigBytes)
  } catch (_) {}

  // Filter items to only those with remarks if user wants, or show all
  const displayItems = items.length > 0 ? items : [
    {
      sl_no: '1',
      description: 'NO ITEMS SPECIFIED',
      po_qty: '0',
      uom: 'PCS',
      heat_number: 'N/A',
      remarks: 'No remarks',
    },
  ]

  // Pagination support: items per page
  const itemsPerPage = 8
  const totalPages = Math.max(1, Math.ceil(displayItems.length / itemsPerPage))

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    let curY = pageHeight - 30

    // 1. Header Banner
    if (embeddedHeaderImg) {
      const headerAspect = embeddedHeaderImg.width / embeddedHeaderImg.height
      const hHeight = Math.min(65, contentWidth / headerAspect)
      page.drawImage(embeddedHeaderImg, {
        x: marginX,
        y: curY - hHeight,
        width: contentWidth,
        height: hHeight,
      })
      curY -= (hHeight + 15)
    } else {
      // Fallback Vector Corporate Banner
      page.drawRectangle({
        x: marginX,
        y: curY - 50,
        width: contentWidth,
        height: 50,
        color: rgb(0.04, 0.12, 0.28),
      })
      page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
        x: marginX + 15,
        y: curY - 24,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1),
      })
      page.drawText('DUBAI, UNITED ARAB EMIRATES | QA/QC & TECHNICAL COMPLIANCE', {
        x: marginX + 15,
        y: curY - 40,
        size: 8,
        font: fontRegular,
        color: rgb(0.85, 0.9, 1),
      })
      curY -= 65
    }

    // 2. Metadata Block
    const metaY = curY
    page.drawText(`Date: ${metadata.date || new Date().toLocaleDateString('en-GB')}`, {
      x: marginX,
      y: metaY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(`TO: ${metadata.to_client || 'VALUED CUSTOMER'}`, {
      x: marginX,
      y: metaY - 14,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(`PO Number: ${metadata.po_number || 'N/A'}`, {
      x: marginX,
      y: metaY - 28,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(`MSG Ref: ${metadata.msg_ref || 'MSG/LOC/' + new Date().getFullYear()}`, {
      x: marginX,
      y: metaY - 42,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    curY -= 62

    // 3. Document Title
    const titleText = 'LETTER OF COMPLIANCE'
    const titleWidth = fontBold.widthOfTextAtSize(titleText, 13)
    page.drawText(titleText, {
      x: (pageWidth - titleWidth) / 2,
      y: curY,
      size: 13,
      font: fontBold,
      color: rgb(0.05, 0.15, 0.35),
    })
    page.drawLine({
      start: { x: (pageWidth - titleWidth) / 2, y: curY - 2 },
      end: { x: (pageWidth + titleWidth) / 2, y: curY - 2 },
      thickness: 1.2,
      color: rgb(0.05, 0.15, 0.35),
    })

    curY -= 20

    // 4. Compliance Declaration Statement
    const { verb, noun } = buildComplianceWording(metadata.action_type)
    const statement = metadata.custom_declaration ||
      `We hereby confirm that below listed items have been ${verb.toUpperCase()} as per the client PO requirements. Subsequent to the ${noun}, dimensional verification and visual inspection were conducted, and the items are found to be acceptable and in full compliance with the applicable industry standards.`

    const statementLines = wrapText(statement, contentWidth, fontRegular, 9)
    for (const line of statementLines) {
      page.drawText(line, {
        x: marginX,
        y: curY,
        size: 9,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.15),
      })
      curY -= 12
    }

    curY -= 10

    // 5. Items Table Header
    const colWidths = [32, 195, 42, 38, 76, 132.28] // sum = 515.28
    const colHeaders = ['Sl.No', 'Description', 'PO Qty', 'UOM', 'Heat Number', 'Remarks']
    const tableHeaderHeight = 20

    // Draw header row background
    page.drawRectangle({
      x: marginX,
      y: curY - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: rgb(0.92, 0.95, 0.99),
      borderColor: rgb(0.3, 0.3, 0.3),
      borderWidth: 0.75,
    })

    let curColX = marginX
    for (let c = 0; c < colHeaders.length; c++) {
      const headerText = colHeaders[c]
      const textW = fontBold.widthOfTextAtSize(headerText, 8.5)
      const xOffset = c === 1 || c === 5 ? curColX + 4 : curColX + (colWidths[c] - textW) / 2
      page.drawText(headerText, {
        x: xOffset,
        y: curY - 14,
        size: 8.5,
        font: fontBold,
        color: rgb(0.08, 0.15, 0.3),
      })
      if (c > 0) {
        page.drawLine({
          start: { x: curColX, y: curY },
          end: { x: curColX, y: curY - tableHeaderHeight },
          thickness: 0.75,
          color: rgb(0.3, 0.3, 0.3),
        })
      }
      curColX += colWidths[c]
    }

    curY -= tableHeaderHeight

    // 6. Items Table Rows
    const pageItems = displayItems.slice(pageNum * itemsPerPage, (pageNum + 1) * itemsPerPage)

    for (let r = 0; r < pageItems.length; r++) {
      const item = pageItems[r]
      const descLines = wrapText(String(item.description || ''), colWidths[1] - 8, fontRegular, 8)
      const remLines = wrapText(String(item.remarks || '-'), colWidths[5] - 8, fontRegular, 8)
      const lineCount = Math.max(1, descLines.length, remLines.length)
      const rowHeight = Math.max(22, lineCount * 11 + 6)

      // Row background (alternate striping)
      page.drawRectangle({
        x: marginX,
        y: curY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: r % 2 === 0 ? rgb(1, 1, 1) : rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.4, 0.4, 0.4),
        borderWidth: 0.5,
      })

      // Column borders
      let colX = marginX
      for (let c = 0; c < colWidths.length; c++) {
        if (c > 0) {
          page.drawLine({
            start: { x: colX, y: curY },
            end: { x: colX, y: curY - rowHeight },
            thickness: 0.5,
            color: rgb(0.4, 0.4, 0.4),
          })
        }
        colX += colWidths[c]
      }

      // Sl No
      const slText = String(item.sl_no || r + 1)
      const slW = fontRegular.widthOfTextAtSize(slText, 8)
      page.drawText(slText, {
        x: marginX + (colWidths[0] - slW) / 2,
        y: curY - 14,
        size: 8,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      })

      // Description lines
      let dY = curY - 12
      for (const line of descLines) {
        page.drawText(line, {
          x: marginX + colWidths[0] + 4,
          y: dY,
          size: 8,
          font: fontRegular,
          color: rgb(0.1, 0.1, 0.1),
        })
        dY -= 10
      }

      // PO Qty
      const qtyText = String(item.po_qty || '1')
      const qtyW = fontRegular.widthOfTextAtSize(qtyText, 8)
      page.drawText(qtyText, {
        x: marginX + colWidths[0] + colWidths[1] + (colWidths[2] - qtyW) / 2,
        y: curY - 14,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      // UOM
      const uomText = String(item.uom || 'PCS')
      const uomW = fontRegular.widthOfTextAtSize(uomText, 8)
      page.drawText(uomText, {
        x: marginX + colWidths[0] + colWidths[1] + colWidths[2] + (colWidths[3] - uomW) / 2,
        y: curY - 14,
        size: 8,
        font: fontRegular,
        color: rgb(0.1, 0.1, 0.1),
      })

      // Heat Number
      const heatText = String(item.heat_number || 'N/A')
      const heatW = fontRegular.widthOfTextAtSize(heatText, 8)
      page.drawText(heatText, {
        x: marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + (colWidths[4] - heatW) / 2,
        y: curY - 14,
        size: 8,
        font: fontBold,
        color: rgb(0.05, 0.2, 0.5),
      })

      // Remarks lines
      let rY = curY - 12
      for (const line of remLines) {
        page.drawText(line, {
          x: marginX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 4,
          y: rY,
          size: 8,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
        })
        rY -= 10
      }

      curY -= rowHeight
    }

    curY -= 20

    // 7. Signature & QA/QC Stamp Block (Only on last page or bottom of each)
    if (pageNum === totalPages - 1) {
      page.drawText('For MSG Oilfield Equipment Trading LLC,', {
        x: marginX,
        y: curY,
        size: 9.5,
        font: fontBold,
        color: rgb(0.08, 0.15, 0.3),
      })

      curY -= 15

      // Draw QA/QC Stamp & Signature Overlay
      const sigBlockY = curY - 45
      if (embeddedStampImg) {
        page.drawImage(embeddedStampImg, {
          x: marginX + 10,
          y: sigBlockY - 5,
          width: 58,
          height: 58,
        })
      }
      if (embeddedSigImg) {
        page.drawImage(embeddedSigImg, {
          x: marginX + (embeddedStampImg ? 50 : 15),
          y: sigBlockY,
          width: 80,
          height: 45,
        })
      }

      curY -= 55

      // Signatory Name & Title
      page.drawText(metadata.signatory_name || 'Vijay Dsouza', {
        x: marginX,
        y: curY,
        size: 9.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      page.drawText(metadata.signatory_title || '( QA / QC Dept )', {
        x: marginX,
        y: curY - 12,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      })
    }

    // 8. Footer Section
    if (embeddedFooterImg) {
      const footerAspect = embeddedFooterImg.width / embeddedFooterImg.height
      const fHeight = Math.min(38, contentWidth / footerAspect)
      page.drawImage(embeddedFooterImg, {
        x: marginX,
        y: 20,
        width: contentWidth,
        height: fHeight,
      })
    } else {
      page.drawLine({
        start: { x: marginX, y: 35 },
        end: { x: marginX + contentWidth, y: 35 },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      })
      page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC | ISO 9001:2015 CERTIFIED', {
        x: marginX,
        y: 22,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      })
    }

    // Page Number
    const pageStr = `Page ${pageNum + 1} of ${totalPages}`
    const pageStrW = fontOblique.widthOfTextAtSize(pageStr, 8)
    page.drawText(pageStr, {
      x: marginX + contentWidth - pageStrW,
      y: 22,
      size: 8,
      font: fontOblique,
      color: rgb(0.4, 0.4, 0.4),
    })
  }

  return await pdfDoc.save()
}

// -------------------------------------------------------------
// PDF Generator: Material Location Tags (2 per A4 Page)
// -------------------------------------------------------------
export async function generateMaterialLocationTagsPdf(
  items: LOCItem[],
  options: {
    clientName?: string
    poNumber?: string
    includeSignature?: boolean
  } = {}
): Promise<Uint8Array> {
  const { clientName = '', poNumber = '', includeSignature = true } = options
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginX = 28
  const tagWidth = pageWidth - marginX * 2 // 539.28
  const tagHeight = 370 // 2 tags per page (total 740, fits easily within 841.89)

  const sigBytes = await tryFetchImageBytes('/assets/signature.png')
  let embeddedSigImg: any = null
  try {
    if (includeSignature && sigBytes) embeddedSigImg = await pdfDoc.embedPng(sigBytes)
  } catch (_) {}

  // 2 tags per page
  const totalPages = Math.ceil(items.length / 2)

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    const pageItems = items.slice(pageIdx * 2, pageIdx * 2 + 2)

    for (let slotIdx = 0; slotIdx < pageItems.length; slotIdx++) {
      const item = pageItems[slotIdx]
      // slot 0 is top tag, slot 1 is bottom tag
      const tagTopY = slotIdx === 0 ? pageHeight - 35 : pageHeight - 35 - tagHeight - 25

      // Outer Tag Box (Navy border)
      page.drawRectangle({
        x: marginX,
        y: tagTopY - tagHeight,
        width: tagWidth,
        height: tagHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.12, 0.23, 0.54), // Hex #1E3A8A
        borderWidth: 2,
      })

      // Inner Header Section
      let curY = tagTopY - 12

      // Tag Header Bar
      page.drawRectangle({
        x: marginX + 8,
        y: curY - 32,
        width: tagWidth - 16,
        height: 32,
        color: rgb(0.95, 0.97, 1),
      })

      page.drawText('MATERIAL LOCATION / LOC TAG', {
        x: marginX + 16,
        y: curY - 18,
        size: 11,
        font: fontBold,
        color: rgb(0.06, 0.18, 0.38),
      })
      page.drawText('MSG OILFIELD SUPPLIES & WAREHOUSE MANAGEMENT', {
        x: marginX + 16,
        y: curY - 28,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.3, 0.4, 0.55),
      })

      const slText = `SL NO: ${item.sl_no}`
      const slW = fontBold.widthOfTextAtSize(slText, 11)
      page.drawText(slText, {
        x: marginX + tagWidth - 24 - slW,
        y: curY - 18,
        size: 11,
        font: fontBold,
        color: rgb(0.85, 0.15, 0.15),
      })
      const refText = `PO: ${poNumber || item.supplier_po || 'N/A'}`
      const refW = fontRegular.widthOfTextAtSize(refText, 8)
      page.drawText(refText, {
        x: marginX + tagWidth - 24 - refW,
        y: curY - 28,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      })

      curY -= 42

      // HIGH-VISIBILITY LOCATION BOX
      const locBoxHeight = 52
      const locationText = item.location && item.location.trim() ? item.location.trim().toUpperCase() : 'LOC: NOT FOUND'
      const isFound = locationText !== 'LOC: NOT FOUND'

      page.drawRectangle({
        x: marginX + 8,
        y: curY - locBoxHeight,
        width: tagWidth - 16,
        height: locBoxHeight,
        color: isFound ? rgb(0.9, 0.95, 1) : rgb(1, 0.93, 0.93),
        borderColor: isFound ? rgb(0.15, 0.35, 0.7) : rgb(0.85, 0.15, 0.15),
        borderWidth: 1.5,
      })

      page.drawText('STORE / RACK / BIN LOCATION', {
        x: marginX + 16,
        y: curY - 14,
        size: 7.5,
        font: fontBold,
        color: isFound ? rgb(0.2, 0.35, 0.6) : rgb(0.7, 0.15, 0.15),
      })

      const locFont = fontBold
      const locFontSize = 18
      const locTextW = locFont.widthOfTextAtSize(locationText, locFontSize)
      page.drawText(locationText, {
        x: marginX + (tagWidth - locTextW) / 2,
        y: curY - 38,
        size: locFontSize,
        font: locFont,
        color: isFound ? rgb(0.06, 0.15, 0.35) : rgb(0.85, 0.15, 0.15),
      })

      curY -= (locBoxHeight + 12)

      // SPECIFICATIONS TABLE
      const specRows = [
        { label: 'Item Description:', value: item.description },
        { label: 'PO Quantity / UOM:', value: `${item.po_qty} ${item.uom}` },
        { label: 'Heat Number:', value: item.heat_number || 'N/A' },
        { label: 'Certificate No (MTC):', value: item.cert_number || 'Under Verification / MTC Linked' },
        { label: 'Manufacturer / MAKE:', value: item.make || 'Original Approved Mill' },
        { label: 'Compliance Remarks:', value: item.remarks || 'Standard Material / Direct Stock' },
      ]

      const specBoxHeight = 145
      page.drawRectangle({
        x: marginX + 8,
        y: curY - specBoxHeight,
        width: tagWidth - 16,
        height: specBoxHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.75, 0.8, 0.85),
        borderWidth: 1,
      })

      let specY = curY - 16
      for (const row of specRows) {
        page.drawText(row.label, {
          x: marginX + 16,
          y: specY,
          size: 8,
          font: fontBold,
          color: rgb(0.25, 0.3, 0.4),
        })

        const valLines = wrapText(row.value, tagWidth - 190, fontRegular, 8)
        let valY = specY
        for (const line of valLines.slice(0, 2)) {
          page.drawText(line, {
            x: marginX + 150,
            y: valY,
            size: 8,
            font: row.label.includes('Heat') || row.label.includes('Quantity') ? fontBold : fontRegular,
            color: row.label.includes('Heat') ? rgb(0.06, 0.2, 0.5) : rgb(0.1, 0.1, 0.1),
          })
          valY -= 9
        }
        specY -= Math.max(18, valLines.slice(0, 2).length * 10 + 4)
      }

      curY -= (specBoxHeight + 10)

      // VERIFICATION & SIGNATURE BLOCK
      page.drawRectangle({
        x: marginX + 8,
        y: curY - 50,
        width: tagWidth - 16,
        height: 50,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.8, 0.85, 0.9),
        borderWidth: 0.75,
      })

      page.drawText('STOREKEEPER VERIFICATION', {
        x: marginX + 16,
        y: curY - 16,
        size: 7.5,
        font: fontBold,
        color: rgb(0.3, 0.4, 0.5),
      })
      page.drawText('Verified Physical Tag & Location', {
        x: marginX + 16,
        y: curY - 32,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      })

      page.drawText('QA/QC INSPECTOR SIGN & STAMP', {
        x: marginX + tagWidth / 2 + 10,
        y: curY - 16,
        size: 7.5,
        font: fontBold,
        color: rgb(0.3, 0.4, 0.5),
      })

      if (embeddedSigImg) {
        page.drawImage(embeddedSigImg, {
          x: marginX + tagWidth / 2 + 10,
          y: curY - 44,
          width: 55,
          height: 25,
        })
      }
      page.drawText('Vijay Dsouza (QA/QC Dept)', {
        x: marginX + tagWidth / 2 + 75,
        y: curY - 32,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
    }
  }

  return await pdfDoc.save()
}

// -------------------------------------------------------------
// Helper: Text Wrapping
// -------------------------------------------------------------
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  if (!text) return ['']
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(candidate, fontSize)
    if (width <= maxWidth) {
      currentLine = candidate
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines.length > 0 ? lines : [text]
}

// -------------------------------------------------------------
// Helper: Data URL to Bytes
// -------------------------------------------------------------
function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  try {
    const parts = dataUrl.split(',')
    const base64 = parts[1]
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch (_) {
    return null
  }
}

// -------------------------------------------------------------
// Draft History Persistence (localStorage)
// -------------------------------------------------------------
const LOC_DRAFTS_KEY = 'msg_loc_drafts_v1'

export function saveLOCDraft(metadata: LOCMetadata, items: LOCItem[]): LOCDraft {
  const drafts = getLOCDrafts()
  const newDraft: LOCDraft = {
    id: 'LOC_' + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    metadata,
    items,
  }
  const updated = [newDraft, ...drafts.slice(0, 19)]
  localStorage.setItem(LOC_DRAFTS_KEY, JSON.stringify(updated))
  return newDraft
}

export function getLOCDrafts(): LOCDraft[] {
  try {
    const raw = localStorage.getItem(LOC_DRAFTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

export function deleteLOCDraft(id: string): void {
  const drafts = getLOCDrafts().filter(d => d.id !== id)
  localStorage.setItem(LOC_DRAFTS_KEY, JSON.stringify(drafts))
}
