// Technical Sourcing, Item Splitting, Dual Excel (Client/Stores) & CIPL Engine
// Integrated from https://github.com/konkanishow-gif/msg123

import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import JSZip from 'jszip'

export interface SourcingLineItem {
  id: string
  sl_no: number
  client_po_item_no: string
  description: string
  qty: number
  uom: string
  heat_number: string
  certificate_number: string
  make: string
  remarks: string
  supplier_name: string
  supplier_po_number: string
  hs_code: string
  country_of_origin: string
  unit_price: number
  total_price: number
  unit_weight_kg: number
  total_net_weight_kg: number
  total_gross_weight_kg: number
  package_no: string
  is_machined?: boolean
  parent_sl_no?: number
}

export interface SourcingWorksheetData {
  id?: string
  client: string
  po_number: string
  msg_ref: string
  order_date?: string
  delivery_date?: string
  currency?: string
  port_of_loading?: string
  port_of_discharge?: string
  vessel_flight?: string
  payment_terms?: string
  invoice_number?: string
  bapco_transmittal?: string
  items: SourcingLineItem[]
  filter_machined_only?: boolean
  saved_at?: string
  editor_username?: string
}

export const MANUFACTURING_KEYWORDS = [
  'machined',
  'machining',
  'machine',
  'fabricated',
  'fabrication',
  'fabricate',
  'fab',
  'made from',
  'modified',
  'modify',
  'mod',
  'locally',
  'offered',
  'offer',
]

export const MAKE_MAPPINGS: [RegExp, string][] = [
  [/JD[-_]?STOCK|\bDELCORTE\b|MEGA\/JD/i, 'DELCORTE FRANCE'],
  [/BENKAN\/TK|\bBENKAN\b/i, 'BENKAN THAILAND'],
  [/\bBOTHWELL\b/i, 'BOTHWELL TAIWAN'],
  [/\bCHERO\b|\bCHERO\s+PIPING\b|\bCHERO\s+FORGED\b|\bCHERO\s*F\b/i, 'CHERO ITALY'],
  [/\bBONNEY\s+FORGE\b/i, 'BONNEY FORGE USA'],
  [/\bPROMAT\b/i, 'PROMAT UK'],
  [/OMSA[-_]?STOCK|\bOMSA\b/i, 'OMSA GERMANY'],
  [/W[-_]?STOCK|WMA?ASS/i, 'WMASS GERMANY'],
  [/TK[-_]?STOCK|\bTK\b/i, 'TK KOREA'],
  [/ST&H(?:[-_]?STOCK)?|\bSTH\b/i, 'ST&H KOREA'],
  [/\bMFF\b|METALFAR/i, 'Metalfar Italy'],
  [/\bULMA\b/i, 'ULMA SPAIN'],
  [/\bMELESI\b/i, 'MELESI ITALY'],
  [/\bMEGA\b/i, 'MEGA ITALY'],
  [/\bRACCORTUBI\b/i, 'RACCORTUBI ITALY'],
  [/\bKITZ\b/i, 'KITZ JAPAN'],
  [/\bVALVEWORKS\b/i, 'VALVEWORKS USA'],
  [/\bSEGYUNG\b/i, 'SEGYUNG KOREA'],
]

export function autoDetectMake(rawText: string): string {
  if (!rawText) return ''
  for (const [pattern, makeVal] of MAKE_MAPPINGS) {
    if (pattern.test(rawText)) return makeVal
  }
  return ''
}

export function autoDetectCountryOfOrigin(make: string = '', desc: string = '', remarks: string = ''): string {
  const text = `${make} ${desc} ${remarks}`.toUpperCase()
  if (/\b(FRANCE|DELCORTE)\b/.test(text)) return 'France'
  if (/\b(GERMANY|OMSA|WMASS|WMAASS)\b/.test(text)) return 'Germany'
  if (/\b(ITALY|ITALIAN|METALFAR|MFF|MELESI|MEGA|RACCORTUBI|AR\s*ITALY)\b/.test(text) || text.includes('ITAL')) return 'Italy'
  if (/\b(KOREA|TK|ST&H|STH|SEGYUNG)\b/.test(text)) return 'South Korea'
  if (/\b(THAILAND|BENKAN)\b/.test(text)) return 'Thailand'
  if (/\b(SPAIN|ULMA)\b/.test(text)) return 'Spain'
  if (/\b(TAIWAN)\b/.test(text)) return 'Taiwan'
  if (/\b(USA|UNITED STATES|VALVEWORKS)\b/.test(text)) return 'USA'
  if (/\b(UK|UNITED KINGDOM|ENGLAND|PROMAT)\b/.test(text)) return 'United Kingdom'
  if (/\b(JAPAN|KITZ)\b/.test(text)) return 'Japan'
  if (/\b(INDIA)\b/.test(text)) return 'India'
  if (/\b(CHINA)\b/.test(text)) return 'China'
  if (/\b(UAE|UNITED ARAB EMIRATES|DUBAI)\b/.test(text)) return 'UAE'
  return 'Italy'
}

export function autoDetectHSCode(descText: string = ''): string {
  if (!descText) return '7307.93.00'
  const text = descText.toUpperCase()
  if (/\b(FLANGE|WNRF|BLIND|SPECTACLE|SLIP-ON|SO\s*FLANGE|SW\s*FLANGE|RTJ\s*FLANGE)\b/.test(text)) {
    if (/\b(316|316L|304|304L|SS|STAINLESS|INCONEL|DUPLEX|SUPER DUPLEX)\b/.test(text)) {
      return '7307.21.00'
    }
    return '7307.91.00'
  }
  if (/\b(ELBOW|TEE|REDUCER|CAP|CROSS|ECC\.?\s*RED|CONC\.?\s*RED|BEND)\b/.test(text)) {
    if (/\b(316|316L|304|304L|SS|STAINLESS)\b/.test(text)) {
      return '7307.23.00'
    }
    return '7307.93.00'
  }
  if (/\b(SWAGE|NIPPLE|COUPLING|UNION|WELDOLET|SOCKOLET|THREADOLET|NIPPOLET|LATROLET|BUSHING|PLUG|OLET)\b/.test(text)) {
    if (/\b(316|316L|304|304L|SS|STAINLESS)\b/.test(text)) {
      return '7307.29.00'
    }
    return '7307.92.00'
  }
  if (/\b(PIPE|TUBE|SMLS|TUBING)\b/.test(text)) {
    return '7304.19.00'
  }
  if (/\b(STUD|BOLT|NUT|FASTENER)\b/.test(text)) {
    return '7318.15.00'
  }
  if (/\b(GASKET|SPIRAL WOUND)\b/.test(text)) {
    return '8484.10.00'
  }
  if (/\b(VALVE|BALL VALVE|CHECK VALVE|GATE VALVE)\b/.test(text)) {
    return '8481.80.00'
  }
  return '7307.99.00'
}

export function estimateUnitWeight(desc: string = '', _uom: string = 'EA'): number {
  const d = desc.toUpperCase()
  let wt = 0.5
  if (d.includes('DN 50') || d.includes('2"') || d.includes('2 INCH')) {
    wt = d.includes('#3000') ? 0.75 : 1.1
  } else if (d.includes('DN 25') || d.includes('1"') || d.includes('1 INCH')) {
    wt = d.includes('#3000') ? 0.35 : 0.5
  } else if (d.includes('DN 20') || d.includes('3/4"')) {
    wt = d.includes('#3000') ? 0.2 : 0.25
  } else if (d.includes('DN 15') || d.includes('1/2"')) {
    wt = d.includes('#3000') ? 0.1 : 0.15
  } else if (d.includes('DN 10') || d.includes('3/8"')) {
    wt = d.includes('#3000') ? 0.05 : 0.08
  } else if (d.includes('FLANGE')) {
    wt = 4.5
  } else if (d.includes('VALVE')) {
    wt = 3.5
  } else if (d.includes('TEE')) {
    wt = 0.8
  } else if (d.includes('ELBOW')) {
    wt = 0.6
  } else if (d.includes('NIPPLE') || d.includes('PLUG')) {
    wt = 0.15
  }
  return wt
}

export function isMeaningfulItem(item: { remarks?: string; description?: string }): boolean {
  const text = `${item.remarks || ''} ${item.description || ''}`.toLowerCase()
  return MANUFACTURING_KEYWORDS.some(kw => new RegExp(`\\b${kw}`, 'i').test(text))
}

export function numToWords(num: number): string {
  const rounded = Math.round(num)
  if (rounded === 0) return 'ZERO'

  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ]
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  function convertBelowThousand(n: number): string {
    const res: string[] = []
    if (n >= 100) {
      res.push(ones[Math.floor(n / 100)] + ' HUNDRED')
      n %= 100
    }
    if (n >= 20) {
      res.push(tens[Math.floor(n / 10)])
      n %= 10
    }
    if (n > 0) {
      res.push(ones[n])
    }
    return res.join(' ')
  }

  const scales: [number, string][] = [
    [1000000000, 'BILLION'],
    [1000000, 'MILLION'],
    [1000, 'THOUSAND']
  ]
  const words: string[] = []
  let remainder = rounded

  for (const [scaleVal, scaleName] of scales) {
    if (remainder >= scaleVal) {
      const chunk = Math.floor(remainder / scaleVal)
      words.push(convertBelowThousand(chunk) + ' ' + scaleName)
      remainder %= scaleVal
    }
  }

  if (remainder > 0) {
    words.push(convertBelowThousand(remainder))
  }

  return words.join(' ').trim()
}

export function formatFullHsCode(hs?: string): string {
  if (!hs) return '730799000000'
  const clean = String(hs).replace(/[^0-9]/g, '')
  if (clean.length === 8) {
    return clean + '0000'
  } else if (clean.length === 6) {
    return clean + '000000'
  }
  return clean || '730799000000'
}

async function fetchLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch('/logo.png')
    if (res.ok) return await res.arrayBuffer()
  } catch {}
  try {
    const res2 = await fetch('/assets/logo.png')
    if (res2.ok) return await res2.arrayBuffer()
  } catch {}
  return null
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function applyRegionBorders(
  ws: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  border: Partial<ExcelJS.Borders>
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (let c = startCol; c <= endCol; c++) {
      row.getCell(c).border = border
    }
  }
}

// 1 & 2. High-Fidelity Summary Sheet Generator (Client: 9 cols, Stores: 11 cols)
export async function generateSummaryExcelWorkbook(
  data: SourcingWorksheetData,
  isInternal: boolean = false,
  filterMachinedOnly: boolean = false
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('SUMMARY SHEET', {
    views: [{ showGridLines: true }]
  })

  const thinSide: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
  const thinBorder: Partial<ExcelJS.Borders> = {
    left: thinSide,
    right: thinSide,
    top: thinSide,
    bottom: thinSide,
  }

  const headerFont = { name: 'Calibri', size: 16, bold: true }
  const metaLabelFont = { name: 'Calibri', size: 11, bold: true }
  const tableHeaderFont = { name: 'Calibri', size: 10, bold: true }
  const dataFont = { name: 'Calibri', size: 10 }

  let headers: string[]
  let maxColLetter: string
  let totalCols: number

  if (isInternal) {
    headers = [
      'SL NO', 'CLIENT PO ITEM NO', 'Description', 'PO Qty', 'UOM',
      'Heat Number', 'Certificate Number', 'MAKE', 'Remarks',
      'SUPPLIER NAME', 'SUPPLIER PO #'
    ]
    maxColLetter = 'K'
    totalCols = 11
  } else {
    headers = [
      'SL NO', 'CLIENT PO ITEM NO', 'Description', 'PO Qty', 'UOM',
      'Heat Number', 'Certificate Number', 'MAKE', 'Remarks'
    ]
    maxColLetter = 'I'
    totalCols = 9
  }

  // Filter items
  const rawItems = data.items || []
  let items = rawItems
  if (filterMachinedOnly) {
    const filtered = rawItems.filter(isMeaningfulItem)
    items = filtered.length > 0 ? filtered : rawItems
  }

  // 1. Title Row: SUMMARY SHEET (height 30)
  ws.mergeCells(`A1:${maxColLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = isInternal ? 'MSG OILFIELD - STORES SUMMARY SHEET' : 'MSG OILFIELD - SUMMARY SHEET'
  titleCell.font = headerFont
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  for (let c = 1; c <= totalCols; c++) {
    ws.getRow(1).getCell(c).border = thinBorder
  }

  // 2. Metadata Block (Rows 2, 3, 4, height 22 each)
  ws.mergeCells('A2:E2')
  const cellA2 = ws.getCell('A2')
  cellA2.value = `Client : ${data.client || ''}`
  cellA2.font = metaLabelFont
  cellA2.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(2).height = 22

  ws.mergeCells('A3:E3')
  const cellA3 = ws.getCell('A3')
  cellA3.value = `PO Number: ${data.po_number || ''}`
  cellA3.font = metaLabelFont
  cellA3.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(3).height = 22

  ws.mergeCells('A4:E4')
  const cellA4 = ws.getCell('A4')
  cellA4.value = `MSG Ref: ${data.msg_ref || ''}`
  cellA4.font = metaLabelFont
  cellA4.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(4).height = 22

  // Spacer and Logo merged blocks
  if (isInternal) {
    ws.mergeCells('F2:I4')
    ws.mergeCells('J2:K4')
  } else {
    ws.mergeCells('F2:H4')
    ws.mergeCells('I2:I4')
  }

  for (let r = 2; r <= 4; r++) {
    for (let c = 1; c <= totalCols; c++) {
      ws.getRow(r).getCell(c).border = thinBorder
    }
  }

  // Logo Embed
  const logoBuf = await fetchLogoBuffer()
  if (logoBuf) {
    try {
      const imgId = wb.addImage({
        buffer: logoBuf,
        extension: 'png',
      })
      ws.addImage(imgId, {
        tl: { col: isInternal ? 9.05 : 8.05, row: 1.05 },
        ext: { width: 135, height: 55 }
      })
    } catch {}
  }

  // 3. Table Headers (Row 5, height 24)
  ws.getRow(5).height = 24
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' },
  }

  headers.forEach((hText, idx) => {
    const colIdx = idx + 1
    const cell = ws.getRow(5).getCell(colIdx)
    cell.value = hText
    cell.font = tableHeaderFont
    cell.fill = headerFill
    cell.border = thinBorder

    const isCenter = [
      'SL NO', 'CLIENT PO ITEM NO', 'PO Qty', 'UOM',
      'Heat Number', 'Certificate Number', 'MAKE',
      'SUPPLIER NAME', 'SUPPLIER PO #'
    ].includes(hText)

    cell.alignment = {
      horizontal: isCenter ? 'center' : 'left',
      vertical: 'middle',
      wrapText: true,
    }
  })

  // 4. Data Rows (Row 6 onwards, height 26 each)
  const startRow = 6
  items.forEach((item, idx) => {
    const rowIdx = startRow + idx
    const row = ws.getRow(rowIdx)
    row.height = 26

    const slVal = item.sl_no || idx + 1
    const cpoVal = String(item.client_po_item_no || item.sl_no || (idx + 1)).trim()
    const descVal = item.description || ''

    const rawQty = (item as any).qty
    let valQty: number | string = rawQty
    if (typeof rawQty === 'string' && /of/i.test(rawQty)) {
      valQty = rawQty.toUpperCase()
    } else {
      const n = Number(rawQty)
      if (!isNaN(n)) valQty = n
    }

    const cSl = row.getCell(1)
    cSl.value = slVal
    cSl.alignment = { horizontal: 'center', vertical: 'middle' }

    const cCpo = row.getCell(2)
    cCpo.value = cpoVal
    cCpo.alignment = { horizontal: 'center', vertical: 'middle' }

    const cDesc = row.getCell(3)
    cDesc.value = descVal
    cDesc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

    const cQty = row.getCell(4)
    cQty.value = valQty
    cQty.alignment = { horizontal: 'center', vertical: 'middle' }
    if (typeof valQty === 'number') {
      cQty.numFmt = '#,##0.00'
    }

    const cUom = row.getCell(5)
    cUom.value = item.uom || ''
    cUom.alignment = { horizontal: 'center', vertical: 'middle' }

    const cHeat = row.getCell(6)
    cHeat.value = item.heat_number || ''
    cHeat.alignment = { horizontal: 'center', vertical: 'middle' }

    const cCert = row.getCell(7)
    cCert.value = item.certificate_number || ''
    cCert.alignment = { horizontal: 'center', vertical: 'middle' }

    const cMake = row.getCell(8)
    cMake.value = item.make || ''
    cMake.alignment = { horizontal: 'center', vertical: 'middle' }

    const cRem = row.getCell(9)
    cRem.value = item.remarks || ''
    cRem.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }

    if (isInternal) {
      const cSupp = row.getCell(10)
      cSupp.value = item.supplier_name || ''
      cSupp.alignment = { horizontal: 'center', vertical: 'middle' }

      const cSpo = row.getCell(11)
      cSpo.value = item.supplier_po_number || ''
      cSpo.alignment = { horizontal: 'center', vertical: 'middle' }
    }

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c)
      cell.font = dataFont
      cell.border = thinBorder
    }
  })

  const maxDataRow = Math.max(startRow + items.length - 1, startRow)
  ws.autoFilter = `A5:${maxColLetter}${maxDataRow}`

  // Column Dimensions
  const columnWidths: Record<string, number> = isInternal
    ? {
        A: 10,  // SL NO
        B: 22,  // CLIENT PO ITEM NO
        C: 90,  // Description
        D: 14,  // PO Qty
        E: 10,  // UOM
        F: 22,  // Heat Number
        G: 26,  // Certificate Number
        H: 22,  // MAKE
        I: 30,  // Remarks
        J: 28,  // SUPPLIER NAME
        K: 22   // SUPPLIER PO #
      }
    : {
        A: 10,  // SL NO
        B: 22,  // CLIENT PO ITEM NO
        C: 90,  // Description
        D: 14,  // PO Qty
        E: 10,  // UOM
        F: 22,  // Heat Number
        G: 26,  // Certificate Number
        H: 22,  // MAKE
        I: 30   // Remarks
      }

  for (const [colLtr, w] of Object.entries(columnWidths)) {
    const colNum = colLtr.charCodeAt(0) - 64
    if (colNum <= totalCols) {
      ws.getColumn(colNum).width = w
    }
  }

  return wb
}

export async function generateClientSummaryExcel(
  data: SourcingWorksheetData,
  filterMachinedOnly: boolean = false
): Promise<void> {
  const wb = await generateSummaryExcelWorkbook(data, false, filterMachinedOnly)
  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = safePo
    ? `Client_Summary_${safeMsgRef}_${safePo}.xlsx`
    : `Client_Summary_${safeMsgRef}.xlsx`
  await downloadWorkbook(wb, filename)
}

export async function generateStoresSummaryExcel(
  data: SourcingWorksheetData,
  filterMachinedOnly: boolean = false
): Promise<void> {
  const wb = await generateSummaryExcelWorkbook(data, true, filterMachinedOnly)
  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = safePo
    ? `Internal_Stores_Summary_${safeMsgRef}_${safePo}.xlsx`
    : `Internal_Stores_Summary_${safeMsgRef}.xlsx`
  await downloadWorkbook(wb, filename)
}

// 3. High-Fidelity CIPL Excel Generator (Two Worksheets: "INVOICE" & "PACKING LIST")
export async function generateCIPLLogisticWorkbook(data: SourcingWorksheetData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()

  const fontFam = 'Arial'
  const fCompany = { name: fontFam, size: 9.5, bold: true }
  const fCompanySub = { name: fontFam, size: 8.5, bold: false }
  const fCompanyTrn = { name: fontFam, size: 8.5, bold: true }
  const fTitle = { name: fontFam, size: 11, bold: true, underline: true as const }
  const fMetaBold = { name: fontFam, size: 8.5, bold: true }
  const fMetaReg = { name: fontFam, size: 8.5, bold: false }
  const fTh = { name: fontFam, size: 8.5, bold: true }
  const fData = { name: fontFam, size: 8.5, bold: false }
  const fDataBold = { name: fontFam, size: 8.5, bold: true }

  const thinSide: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
  const thinBorder: Partial<ExcelJS.Borders> = {
    left: thinSide,
    right: thinSide,
    top: thinSide,
    bottom: thinSide,
  }

  const logoBuf = await fetchLogoBuffer()

  const clientName = (data.client || 'Valoris Energy Services Company').trim() || 'Valoris Energy Services Company'
  const poNumber = String(data.po_number || '10025 // 10044').trim() || '10025 // 10044'
  const msgRef = String(data.msg_ref || 'MSG-0826-2117 / MSG-0926-2135').trim() || 'MSG-0826-2117 / MSG-0926-2135'

  let currency = (data.currency || 'AED').trim().toUpperCase()
  if (currency === '$' || currency === 'DOLLAR' || currency === 'US DOLLAR' || currency === 'US$') {
    currency = 'USD'
  } else if (currency === 'DIRHAM' || currency === 'DHS') {
    currency = 'AED'
  }

  let invNo = data.invoice_number
  if (!invNo) {
    if (msgRef.includes('/')) {
      const parts = msgRef.split('/').map(p => p.trim())
      invNo = parts.map(p => p.endsWith('-CI') ? p : `${p}-CI`).join(' / ')
    } else {
      invNo = msgRef.endsWith('-CI') ? msgRef : `${msgRef}-CI`
    }
  }

  const d = new Date()
  const todayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

  // Process items
  const rawItems = data.items || []
  const processedItems: Array<{
    sl_no: number
    client_po_item_no: string
    description: string
    qty: number
    uom: string
    hs_code: string
    origin: string
    rate: number
    amount: number
    package_type: string
    package_no: string
    dims: string
    unit_weight: number
    total_weight: number
    po_number: string
  }> = []

  const distinctOrigins = new Set<string>()
  const distinctHs = new Set<string>()

  rawItems.forEach((it, idx) => {
    const sl = it.sl_no || (idx + 1)
    const clientPoIt = it.client_po_item_no || String(sl)
    const desc = it.description || ''
    const make = it.make || ''
    const remarks = it.remarks || ''

    const coo = (it.country_of_origin || autoDetectCountryOfOrigin(make, desc, remarks)).toUpperCase()
    const hs = formatFullHsCode(it.hs_code || autoDetectHSCode(desc))

    distinctOrigins.add(coo)
    distinctHs.add(hs)

    let qtyVal = 1
    const rawQty = String(it.qty || '1').trim()
    const mOf = rawQty.match(/([\d.]+)\s*(?:OF|of)/i)
    if (mOf) {
      qtyVal = parseFloat(mOf[1]) || 1
    } else {
      qtyVal = parseFloat(rawQty.replace(/,/g, '')) || 1
    }

    let uom = (it.uom || 'EA').toUpperCase()
    if (['PCS', 'PC', 'NOS'].includes(uom)) {
      uom = 'EA'
    }

    const rateVal = it.unit_price || 25.0
    const amtVal = it.total_price || (qtyVal * rateVal)

    let pkgType = (it.package_no || 'CARTON BOX').toUpperCase()
    if (pkgType.includes('PALLET')) pkgType = 'PALLET'
    else if (pkgType.includes('CRATE')) pkgType = 'WOODEN CRATE'
    else pkgType = 'CARTON BOX'

    const pkgNo = String(it.package_no || '1').replace(/\D/g, '') || '1'
    const unitWt = it.unit_weight_kg || estimateUnitWeight(desc, uom)
    const totWt = it.total_net_weight_kg || Math.round(qtyVal * unitWt * 100) / 100
    const dims = pkgNo === '1' ? '25 X 20 X 10 CM' : '35 X 20 X 15 CM'

    let itemPo = poNumber
    if (poNumber.includes('//')) {
      const parts = poNumber.split('//').map(p => p.trim())
      itemPo = pkgNo === '1' ? parts[0] : parts[parts.length - 1]
    }

    processedItems.push({
      sl_no: sl,
      client_po_item_no: clientPoIt,
      description: desc,
      qty: qtyVal,
      uom,
      hs_code: hs,
      origin: coo,
      rate: rateVal,
      amount: amtVal,
      package_type: pkgType,
      package_no: pkgNo,
      dims,
      unit_weight: unitWt,
      total_weight: totWt,
      po_number: itemPo
    })
  })

  const originSummaryStr = Array.from(distinctOrigins).sort().join(', ') || 'FRANCE, ITALY, TAIWAN'
  const hsSummaryStr = distinctHs.size > 0
    ? `CS Fittings: ${Array.from(distinctHs).sort().join('; ')};`
    : 'CS Fittings: 730799000000;'

  // Helper to render Common Header for both worksheets
  function renderCommonHeader(ws: ExcelJS.Worksheet, titleText: string): number {
    ws.views = [{ showGridLines: true }]

    ws.getColumn(1).width = 8.5   // SR NO
    ws.getColumn(2).width = 46.0  // DESCRIPTION
    ws.getColumn(3).width = 8.0   // QTY
    ws.getColumn(4).width = 8.0   // UOM
    ws.getColumn(5).width = 16.0  // H.S. CODE
    ws.getColumn(6).width = 14.0  // ORIGIN
    ws.getColumn(7).width = 16.0  // UNIT PRICE / UNIT WEIGHT
    ws.getColumn(8).width = 18.0  // TOTAL VALUE / TOTAL WEIGHT

    // Company info
    const c1 = ws.getCell('A1'); c1.value = 'MSG OILFIELD EQUIPMENT TRADING LLC'; c1.font = fCompany
    const c2 = ws.getCell('A2'); c2.value = 'DUBAI INDUSTRIAL CITY (DIC), PHASE 1'; c2.font = fCompanySub
    const c3 = ws.getCell('A3'); c3.value = 'SAI SHUAIB 2, WAREHOUSE NO: J-04,'; c3.font = fCompanySub
    const c4 = ws.getCell('A4'); c4.value = 'DUBAI, UNITED ARAB EMIRATES'; c4.font = fCompanySub
    const c5 = ws.getCell('A5'); c5.value = 'TRN NO:100518964000003'; c5.font = fCompanyTrn

    // Logo Embed at E1
    if (logoBuf) {
      try {
        const imgId = wb.addImage({
          buffer: logoBuf,
          extension: 'png',
        })
        ws.addImage(imgId, {
          tl: { col: 4.1, row: 0.1 },
          ext: { width: 135, height: 45 }
        })
      } catch {}
    }

    // Row 6: Title
    ws.mergeCells('A6:H6')
    const c6 = ws.getCell('A6')
    c6.value = titleText
    c6.font = fTitle
    c6.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(6).height = 22

    // Left Box (A7:D18)
    const leftBoxData = [
      { text: 'CONSIGNEE :-', font: fMetaBold },
      { text: clientName, font: fMetaReg },
      { text: 'Al-Alyha, Abqaiq,', font: fMetaReg },
      { text: 'Eastern Province Area -33267,', font: fMetaReg },
      { text: 'Kingdom of Saudi Arabia', font: fMetaReg },
      { text: 'Tel: +966 38084168', font: fMetaReg },
      { text: '', font: fMetaReg },
      { text: `ORDER NUMBER : ${poNumber}`, font: fMetaBold },
      { text: 'MODE OF SHIPMENT : BY LAND', font: fMetaBold },
      { text: 'FREIGHT TERMS : EX-WORKS', font: fMetaBold },
      { text: 'PLACE OF LOADING : DUBAI, U.A.E', font: fMetaBold },
      { text: 'PLACE OF DISCHARGE : SAUDI ARABIA', font: fMetaBold },
    ]

    // Right Box (E7:H18)
    const rightBoxData = [
      { text: `DATE : ${todayStr}`, font: fMetaBold },
      { text: `Inv.No :              ${invNo}`, font: fMetaBold },
      { text: '', font: fMetaReg },
      { text: `S O.REF: ${msgRef}`, font: fMetaBold },
      { text: 'SOLD TO / INVOICED TO', font: fMetaBold },
      { text: clientName, font: fMetaReg },
      { text: 'Al-Alyha, Abqaiq, Eastern Province Area -33267,', font: fMetaReg },
      { text: 'Kingdom of Saudi Arabia', font: fMetaReg },
      { text: 'TRN : 313093495600003', font: fMetaBold },
      { text: 'HS CODE:', font: fMetaBold },
      { text: hsSummaryStr, font: fMetaReg },
      { text: `COUNTRY OF ORIGIN : ${originSummaryStr}`, font: fMetaBold },
    ]

    for (let i = 0; i < 12; i++) {
      const r = 7 + i
      ws.getRow(r).height = 14.5

      // Left
      ws.mergeCells(`A${r}:D${r}`)
      const cL = ws.getCell(`A${r}`)
      cL.value = leftBoxData[i].text
      cL.font = leftBoxData[i].font
      cL.alignment = { horizontal: 'left', vertical: 'middle' }

      // Right
      ws.mergeCells(`E${r}:H${r}`)
      const cR = ws.getCell(`E${r}`)
      cR.value = rightBoxData[i].text
      cR.font = rightBoxData[i].font
      cR.alignment = { horizontal: 'left', vertical: 'middle' }

      // Outer box borders
      for (let c = 1; c <= 8; c++) {
        const topS = r === 7 ? thinSide : undefined
        const botS = r === 18 ? thinSide : undefined
        const leftS = (c === 1 || c === 5) ? thinSide : undefined
        const rightS = (c === 4 || c === 8) ? thinSide : undefined

        ws.getRow(r).getCell(c).border = {
          top: topS,
          bottom: botS,
          left: leftS,
          right: rightS,
        }
      }
    }

    return 19
  }

  // =========================================================================
  // 1. SHEET: INVOICE
  // =========================================================================
  const wsInv = wb.addWorksheet('INVOICE', { views: [{ showGridLines: true }] })
  const startRowInv = renderCommonHeader(wsInv, 'INVOICE')

  // Table Headers (Row 19)
  const invHeaders = [
    'SR NO', 'DESCRIPTION', 'QTY', 'UOM', 'H.S. CODE', 'ORIGIN',
    `UNIT PRICE/${currency}`, `TOTAL VALUE/${currency}`
  ]
  wsInv.getRow(startRowInv).height = 24
  invHeaders.forEach((h, idx) => {
    const cell = wsInv.getRow(startRowInv).getCell(idx + 1)
    cell.value = h
    cell.font = fTh
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder
  })

  let currRowInv = startRowInv + 1

  // Group items by PO Number
  const poGroups: Record<string, typeof processedItems> = {}
  processedItems.forEach(it => {
    if (!poGroups[it.po_number]) poGroups[it.po_number] = []
    poGroups[it.po_number].push(it)
  })

  let grandTotalAmt = 0
  const invItemRows: number[] = []

  for (const [pNum, pItems] of Object.entries(poGroups)) {
    // PO Header Row
    wsInv.mergeCells(`A${currRowInv}:H${currRowInv}`)
    const cPo = wsInv.getCell(`A${currRowInv}`)
    cPo.value = `PO NO: ${pNum}`
    cPo.font = fDataBold
    cPo.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    applyRegionBorders(wsInv, currRowInv, 1, currRowInv, 8, thinBorder)
    wsInv.getRow(currRowInv).height = 20
    currRowInv++

    pItems.forEach((it, pIdx) => {
      invItemRows.push(currRowInv)
      const r = wsInv.getRow(currRowInv)
      r.height = 20

      const c1 = r.getCell(1); c1.value = pIdx + 1; c1.alignment = { horizontal: 'center', vertical: 'middle' }
      const c2 = r.getCell(2); c2.value = it.description; c2.alignment = { horizontal: 'left', vertical: 'middle' }
      const c3 = r.getCell(3); c3.value = it.qty; c3.alignment = { horizontal: 'center', vertical: 'middle' }
      const c4 = r.getCell(4); c4.value = it.uom; c4.alignment = { horizontal: 'center', vertical: 'middle' }
      const c5 = r.getCell(5); c5.value = it.hs_code; c5.alignment = { horizontal: 'center', vertical: 'middle' }
      const c6 = r.getCell(6); c6.value = it.origin; c6.alignment = { horizontal: 'center', vertical: 'middle' }

      const c7 = r.getCell(7)
      c7.value = it.rate
      c7.alignment = { horizontal: 'right', vertical: 'middle' }
      c7.numFmt = '0.00'

      const c8 = r.getCell(8)
      c8.value = { formula: `C${currRowInv}*G${currRowInv}` }
      c8.alignment = { horizontal: 'right', vertical: 'middle' }
      c8.numFmt = '0.00'

      for (let c = 1; c <= 8; c++) {
        const cell = r.getCell(c)
        cell.font = fData
        cell.border = thinBorder
      }

      grandTotalAmt += it.amount
      currRowInv++
    })
  }

  // Total Row
  const firstInvR = invItemRows[0] || (startRowInv + 2)
  const lastInvR = invItemRows[invItemRows.length - 1] || (startRowInv + 2)

  wsInv.mergeCells(`A${currRowInv}:B${currRowInv}`)
  const cTotLabel = wsInv.getCell(`A${currRowInv}`)
  cTotLabel.value = `TOTAL VALUE IN ${currency}.`
  cTotLabel.font = fDataBold
  cTotLabel.alignment = { horizontal: 'center', vertical: 'middle' }

  const cTotQ = wsInv.getCell(`C${currRowInv}`)
  cTotQ.value = { formula: `SUM(C${firstInvR}:C${lastInvR})` }
  cTotQ.font = fDataBold
  cTotQ.alignment = { horizontal: 'center', vertical: 'middle' }

  const cTotUom = wsInv.getCell(`D${currRowInv}`)
  cTotUom.value = 'NOS'
  cTotUom.font = fDataBold
  cTotUom.alignment = { horizontal: 'center', vertical: 'middle' }

  const cCur = wsInv.getCell(`G${currRowInv}`)
  cCur.value = currency
  cCur.font = fDataBold
  cCur.alignment = { horizontal: 'center', vertical: 'middle' }

  const cTotVal = wsInv.getCell(`H${currRowInv}`)
  cTotVal.value = { formula: `SUM(H${firstInvR}:H${lastInvR})` }
  cTotVal.font = fDataBold
  cTotVal.alignment = { horizontal: 'right', vertical: 'middle' }
  cTotVal.numFmt = '0.00'

  applyRegionBorders(wsInv, currRowInv, 1, currRowInv, 8, thinBorder)
  wsInv.getRow(currRowInv).height = 22
  currRowInv++

  // In Words Row (leave 1 spacer row)
  currRowInv++
  wsInv.mergeCells(`A${currRowInv}:H${currRowInv}`)
  const cWords = wsInv.getCell(`A${currRowInv}`)
  cWords.value = `IN WORDS : ${currency}. ${numToWords(grandTotalAmt)} ONLY`
  cWords.font = fDataBold
  cWords.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  applyRegionBorders(wsInv, currRowInv, 1, currRowInv, 8, thinBorder)
  wsInv.getRow(currRowInv).height = 20
  currRowInv++

  // Shipping Marks & Packing Details Box
  const pkgSet = new Set(processedItems.map(it => `${it.package_type} ${it.package_no}`))
  const totPkgCount = Math.max(pkgSet.size, 1)
  const pkgTypeName = processedItems[0]?.package_type || 'CARTON BOX'
  const totNetWt = processedItems.reduce((sum, it) => sum + it.total_weight, 0)
  const totGrossWt = totNetWt

  const rBoxStart = currRowInv
  const leftBoxInv2 = [
    { text: `PACKING DETAILS: TOTAL OF ${totPkgCount} PACKAGE`, font: fMetaBold },
    { text: `(${totPkgCount} ${pkgTypeName})`, font: fMetaReg },
    { text: `NET WEIGHT : ${totNetWt.toFixed(2)} KGS`, font: fMetaBold },
    { text: `GROSS WEIGHT : ${totGrossWt.toFixed(2)} KGS`, font: fMetaBold },
    { text: '', font: fMetaReg }
  ]
  const rightBoxInv2 = [
    { text: 'SHIPPING MARKS :-', font: fMetaBold },
    { text: clientName, font: fMetaReg },
    { text: 'Al-Alyha, Abqaiq, Eastern Province Area -33267,', font: fMetaReg },
    { text: 'Kingdom of Saudi Arabia', font: fMetaReg },
    { text: `PO REF # ${poNumber}`, font: fMetaBold }
  ]

  for (let i = 0; i < 5; i++) {
    const r = rBoxStart + i
    wsInv.getRow(r).height = 14.5

    wsInv.mergeCells(`A${r}:D${r}`)
    const cL = wsInv.getCell(`A${r}`)
    cL.value = leftBoxInv2[i].text
    cL.font = leftBoxInv2[i].font
    cL.alignment = { horizontal: 'left', vertical: 'middle' }

    wsInv.mergeCells(`E${r}:H${r}`)
    const cR = wsInv.getCell(`E${r}`)
    cR.value = rightBoxInv2[i].text
    cR.font = rightBoxInv2[i].font
    cR.alignment = { horizontal: 'left', vertical: 'middle' }

    for (let c = 1; c <= 8; c++) {
      const topS = i === 0 ? thinSide : undefined
      const botS = i === 4 ? thinSide : undefined
      const leftS = (c === 1 || c === 5) ? thinSide : undefined
      const rightS = (c === 4 || c === 8) ? thinSide : undefined
      wsInv.getRow(r).getCell(c).border = { top: topS, bottom: botS, left: leftS, right: rightS }
    }
  }

  // =========================================================================
  // 2. SHEET: PACKING LIST
  // =========================================================================
  const wsPk = wb.addWorksheet('PACKING LIST', { views: [{ showGridLines: true }] })
  const startRowPk = renderCommonHeader(wsPk, 'PACKING LIST')

  const pkHeaders = [
    'SR NO', 'DESCRIPTION', 'QTY', 'UOM', 'H.S. CODE', 'ORIGIN',
    'UNIT WEIGHT /\nKGS', 'TOTAL WEIGHT /\nKGS'
  ]
  wsPk.getRow(startRowPk).height = 24
  pkHeaders.forEach((h, idx) => {
    const cell = wsPk.getRow(startRowPk).getCell(idx + 1)
    cell.value = h
    cell.font = fTh
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = thinBorder
  })

  let currRowPk = startRowPk + 1

  // Group items by Package
  const pkgGroups: Record<string, { label: string; dims: string; items: typeof processedItems }> = {}
  processedItems.forEach(it => {
    const pKey = `${it.package_type} - ${it.package_no}`
    if (!pkgGroups[pKey]) {
      pkgGroups[pKey] = {
        label: pKey,
        dims: it.dims,
        items: []
      }
    }
    pkgGroups[pKey].items.push(it)
  })

  const pkItemRows: number[] = []
  const pkgSubtotalRows: number[] = []

  for (const [, pInfo] of Object.entries(pkgGroups)) {
    // Package Header Row
    wsPk.mergeCells(`A${currRowPk}:F${currRowPk}`)
    const cPkTitle = wsPk.getCell(`A${currRowPk}`)
    cPkTitle.value = pInfo.label
    cPkTitle.font = fDataBold
    cPkTitle.alignment = { horizontal: 'center', vertical: 'middle' }

    wsPk.mergeCells(`G${currRowPk}:H${currRowPk}`)
    const cPkDims = wsPk.getCell(`G${currRowPk}`)
    cPkDims.value = pInfo.dims
    cPkDims.font = fDataBold
    cPkDims.alignment = { horizontal: 'center', vertical: 'middle' }

    applyRegionBorders(wsPk, currRowPk, 1, currRowPk, 8, thinBorder)
    wsPk.getRow(currRowPk).height = 20
    currRowPk++

    // Sub-group by PO
    const pkgPoGroups: Record<string, typeof processedItems> = {}
    pInfo.items.forEach(it => {
      if (!pkgPoGroups[it.po_number]) pkgPoGroups[it.po_number] = []
      pkgPoGroups[it.po_number].push(it)
    })

    const cartonItemRows: number[] = []

    for (const [pNum, poItems] of Object.entries(pkgPoGroups)) {
      wsPk.mergeCells(`A${currRowPk}:H${currRowPk}`)
      const cPo = wsPk.getCell(`A${currRowPk}`)
      cPo.value = `PO NO: ${pNum}`
      cPo.font = fDataBold
      cPo.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      applyRegionBorders(wsPk, currRowPk, 1, currRowPk, 8, thinBorder)
      wsPk.getRow(currRowPk).height = 20
      currRowPk++

      poItems.forEach((it, pIdx) => {
        pkItemRows.push(currRowPk)
        cartonItemRows.push(currRowPk)
        const r = wsPk.getRow(currRowPk)
        r.height = 20

        const c1 = r.getCell(1); c1.value = pIdx + 1; c1.alignment = { horizontal: 'center', vertical: 'middle' }
        const c2 = r.getCell(2); c2.value = it.description; c2.alignment = { horizontal: 'left', vertical: 'middle' }
        const c3 = r.getCell(3); c3.value = it.qty; c3.alignment = { horizontal: 'center', vertical: 'middle' }
        const c4 = r.getCell(4); c4.value = it.uom; c4.alignment = { horizontal: 'center', vertical: 'middle' }
        const c5 = r.getCell(5); c5.value = it.hs_code; c5.alignment = { horizontal: 'center', vertical: 'middle' }
        const c6 = r.getCell(6); c6.value = it.origin; c6.alignment = { horizontal: 'center', vertical: 'middle' }

        const c7 = r.getCell(7)
        c7.value = it.unit_weight
        c7.alignment = { horizontal: 'right', vertical: 'middle' }
        c7.numFmt = '0.00'

        const c8 = r.getCell(8)
        c8.value = { formula: `C${currRowPk}*G${currRowPk}` }
        c8.alignment = { horizontal: 'right', vertical: 'middle' }
        c8.numFmt = '0.00'

        for (let c = 1; c <= 8; c++) {
          const cell = r.getCell(c)
          cell.font = fData
          cell.border = thinBorder
        }

        currRowPk++
      })
    }

    // Package Subtotal Row
    const rSub = currRowPk
    pkgSubtotalRows.push(rSub)
    const firstCartonR = cartonItemRows[0] || (currRowPk - 1)
    const lastCartonR = cartonItemRows[cartonItemRows.length - 1] || (currRowPk - 1)

    wsPk.mergeCells(`A${currRowPk}:E${currRowPk}`)
    applyRegionBorders(wsPk, currRowPk, 1, currRowPk, 5, thinBorder)

    const cLblNet = wsPk.getCell(`F${currRowPk}`)
    cLblNet.value = 'NET WEIGHT'
    cLblNet.font = fDataBold
    cLblNet.alignment = { horizontal: 'center', vertical: 'middle' }
    cLblNet.border = thinBorder

    const cValNet = wsPk.getCell(`G${currRowPk}`)
    cValNet.value = { formula: `SUM(H${firstCartonR}:H${lastCartonR})` }
    cValNet.font = fDataBold
    cValNet.alignment = { horizontal: 'right', vertical: 'middle' }
    cValNet.numFmt = '0.00'
    cValNet.border = thinBorder

    const cLblGross = wsPk.getCell(`H${currRowPk}`)
    cLblGross.value = { formula: `="GROSS WEIGHT: " & TEXT(G${rSub}, "0.00")` }
    cLblGross.font = fDataBold
    cLblGross.alignment = { horizontal: 'center', vertical: 'middle' }
    cLblGross.border = thinBorder

    wsPk.getRow(currRowPk).height = 20
    currRowPk++
  }

  // Grand Total Packing Rows
  const rGrandNet = currRowPk
  const firstPkR = pkItemRows[0] || (startRowPk + 2)
  const lastPkR = pkItemRows[pkItemRows.length - 1] || (startRowPk + 2)
  const subNetFormula = pkgSubtotalRows.length > 0
    ? '=' + pkgSubtotalRows.map(r => `G${r}`).join('+')
    : `=SUM(H${firstPkR}:H${lastPkR})`

  // Row 1: TOTAL NET WEIGHT IN KGS.
  wsPk.mergeCells(`A${currRowPk}:B${currRowPk}`)
  const cTotPkQ = wsPk.getCell(`C${currRowPk}`)
  cTotPkQ.value = { formula: `SUM(C${firstPkR}:C${lastPkR})` }
  cTotPkQ.font = fDataBold
  cTotPkQ.alignment = { horizontal: 'center', vertical: 'middle' }

  const cTotPkUom = wsPk.getCell(`D${currRowPk}`)
  cTotPkUom.value = 'NOS'
  cTotPkUom.font = fDataBold
  cTotPkUom.alignment = { horizontal: 'center', vertical: 'middle' }

  wsPk.mergeCells(`E${currRowPk}:G${currRowPk}`)
  const cNetTitle = wsPk.getCell(`E${currRowPk}`)
  cNetTitle.value = 'TOTAL NET WEIGHT IN KGS.'
  cNetTitle.font = fDataBold
  cNetTitle.alignment = { horizontal: 'center', vertical: 'middle' }

  const cNetTot = wsPk.getCell(`H${currRowPk}`)
  cNetTot.value = { formula: subNetFormula }
  cNetTot.font = fDataBold
  cNetTot.alignment = { horizontal: 'right', vertical: 'middle' }
  cNetTot.numFmt = '0.00'

  applyRegionBorders(wsPk, currRowPk, 1, currRowPk, 8, thinBorder)
  wsPk.getRow(currRowPk).height = 22
  currRowPk++

  // Row 2: TOTAL GROSS WEIGHT IN KGS.
  const rGrandGross = currRowPk
  wsPk.mergeCells(`E${currRowPk}:G${currRowPk}`)
  const cGrossTitle = wsPk.getCell(`E${currRowPk}`)
  cGrossTitle.value = 'TOTAL GROSS WEIGHT IN KGS.'
  cGrossTitle.font = fDataBold
  cGrossTitle.alignment = { horizontal: 'center', vertical: 'middle' }

  const cGrossTot = wsPk.getCell(`H${currRowPk}`)
  cGrossTot.value = { formula: `H${rGrandNet}` }
  cGrossTot.font = fDataBold
  cGrossTot.alignment = { horizontal: 'right', vertical: 'middle' }
  cGrossTot.numFmt = '0.00'

  applyRegionBorders(wsPk, currRowPk, 5, currRowPk, 8, thinBorder)
  wsPk.getRow(currRowPk).height = 22
  currRowPk += 2

  // Packing Details & Shipping Marks Box
  const rPkBox = currRowPk
  const rightBoxPk2 = [
    { text: 'SHIPPING MARKS :-', font: fMetaBold },
    { text: clientName, font: fMetaReg },
    { text: 'Al-Alyha, Abqaiq, Eastern Province Area -33267,', font: fMetaReg },
    { text: 'Kingdom of Saudi Arabia', font: fMetaReg },
    { text: `PO REF # ${poNumber}`, font: fMetaBold }
  ]

  for (let i = 0; i < 5; i++) {
    const r = rPkBox + i
    wsPk.getRow(r).height = 14.5

    wsPk.mergeCells(`A${r}:D${r}`)
    const cL = wsPk.getCell(`A${r}`)
    if (i === 0) {
      cL.value = `PACKING DETAILS: TOTAL OF ${totPkgCount} PACKAGE`
      cL.font = fMetaBold
    } else if (i === 1) {
      cL.value = `(${totPkgCount} ${pkgTypeName})`
      cL.font = fMetaReg
    } else if (i === 2) {
      cL.value = { formula: `="NET WEIGHT : " & TEXT(H${rGrandNet}, "0.00") & " KGS"` }
      cL.font = fMetaBold
    } else if (i === 3) {
      cL.value = { formula: `="GROSS WEIGHT : " & TEXT(H${rGrandGross}, "0.00") & " KGS"` }
      cL.font = fMetaBold
    } else {
      cL.value = ''
      cL.font = fMetaReg
    }
    cL.alignment = { horizontal: 'left', vertical: 'middle' }

    wsPk.mergeCells(`E${r}:H${r}`)
    const cR = wsPk.getCell(`E${r}`)
    cR.value = rightBoxPk2[i].text
    cR.font = rightBoxPk2[i].font
    cR.alignment = { horizontal: 'left', vertical: 'middle' }

    for (let c = 1; c <= 8; c++) {
      const topS = i === 0 ? thinSide : undefined
      const botS = i === 4 ? thinSide : undefined
      const leftS = (c === 1 || c === 5) ? thinSide : undefined
      const rightS = (c === 4 || c === 8) ? thinSide : undefined
      wsPk.getRow(r).getCell(c).border = { top: topS, bottom: botS, left: leftS, right: rightS }
    }
  }

  return wb
}

export async function generateCIPLLogisticExcel(data: SourcingWorksheetData): Promise<void> {
  const wb = await generateCIPLLogisticWorkbook(data)
  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = safePo
    ? `CIPL_${safeMsgRef}_${safePo}.xlsx`
    : `CIPL_${safeMsgRef}.xlsx`
  await downloadWorkbook(wb, filename)
}

// 4. Supplier Purchase Orders (PO) Package (PDFs bundled into ZIP)
export async function generateSupplierPOZip(data: SourcingWorksheetData): Promise<void> {
  const zip = new JSZip()
  const suppliersMap = new Map<string, SourcingLineItem[]>()

  data.items.forEach(item => {
    const supp = item.supplier_name?.trim() || item.make?.trim() || 'General Mill Supplier'
    if (!suppliersMap.has(supp)) {
      suppliersMap.set(supp, [])
    }
    suppliersMap.get(supp)!.push(item)
  })

  for (const [suppName, items] of suppliersMap.entries()) {
    const pdfDoc = await PDFDocument.create()
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

    const page = pdfDoc.addPage([842, 595]) // Landscape A4
    const { width, height } = page.getSize()

    // Header Banner
    page.drawRectangle({
      x: 0,
      y: height - 85,
      width: width,
      height: 85,
      color: rgb(0.06, 0.15, 0.28),
    })

    page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
      x: 35,
      y: height - 40,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    })

    page.drawText('OFFICIAL SUPPLIER PURCHASE ORDER & SOURCING REQUISITION', {
      x: 35,
      y: height - 60,
      size: 10,
      font: fontBold,
      color: rgb(0.95, 0.6, 0.2),
    })

    page.drawText(`SUPPLIER: ${suppName.toUpperCase()}`, {
      x: 35,
      y: height - 110,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    page.drawText(`MSG Reference PO : ${data.msg_ref || 'PO-SUPP-01'}`, {
      x: 35,
      y: height - 128,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText(`Customer PO Ref : ${data.po_number || '-'}`, {
      x: 35,
      y: height - 144,
      size: 9,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText(`Date of Issue : ${new Date().toISOString().substring(0, 10)}`, {
      x: 520,
      y: height - 110,
      size: 9.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText('Required Quality : EN 10204 3.1 Certified', {
      x: 520,
      y: height - 128,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.2),
    })

    // Table Header
    const tableTop = height - 170
    page.drawRectangle({
      x: 35,
      y: tableTop - 20,
      width: width - 70,
      height: 20,
      color: rgb(0.1, 0.2, 0.4),
    })

    page.drawText('SL', { x: 45, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('Item Description & Specification', { x: 80, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('Qty', { x: 500, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('UOM', { x: 550, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('Heat Number', { x: 610, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText('Remarks / Machining', { x: 710, y: tableTop - 14, size: 8, font: fontBold, color: rgb(1, 1, 1) })

    items.forEach((it, idx) => {
      const rowY = tableTop - 40 - idx * 22
      if (rowY > 60) {
        page.drawRectangle({
          x: 35,
          y: rowY - 4,
          width: width - 70,
          height: 20,
          color: idx % 2 === 0 ? rgb(0.97, 0.98, 1) : rgb(1, 1, 1),
        })

        page.drawText(String(it.sl_no || idx + 1), { x: 45, y: rowY + 2, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(it.description.slice(0, 75), { x: 80, y: rowY + 2, size: 7.5, font: fontMono, color: rgb(0.1, 0.1, 0.1) })
        page.drawText(String(it.qty), { x: 500, y: rowY + 2, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
        page.drawText(it.uom || 'PCS', { x: 550, y: rowY + 2, size: 8, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
        page.drawText(it.heat_number || 'REQUIRED', { x: 610, y: rowY + 2, size: 8, font: fontBold, color: it.heat_number ? rgb(0.7, 0.2, 0.1) : rgb(0.5, 0.5, 0.5) })
        page.drawText((it.remarks || '-').slice(0, 20), { x: 710, y: rowY + 2, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
      }
    })

    // Footer Sign-off
    page.drawText('All mill test certificates (EN 10204 3.1) must accompany physical goods upon delivery to Dubai Industrial City warehouse.', {
      x: 35,
      y: 40,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    })

    const pdfBytes = await pdfDoc.save()
    const safeSupplierName = suppName.replace(/[^A-Za-z0-9]/g, '_')
    zip.file(`PO_${safeSupplierName}.pdf`, pdfBytes)
  }

  const zipContent = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipContent)
  const a = document.createElement('a')
  a.href = url
  a.download = `Supplier_PO_Package_${(data.msg_ref || 'PO').replace(/[\s\/\\:]/g, '_')}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// 5. Local Storage Draft Management
const SOURCING_DRAFTS_KEY = 'msg_oilfield_sourcing_drafts_v1'

export function getSourcingDrafts(): SourcingWorksheetData[] {
  try {
    const raw = localStorage.getItem(SOURCING_DRAFTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveSourcingDraft(data: SourcingWorksheetData): SourcingWorksheetData {
  const drafts = getSourcingDrafts()
  const record: SourcingWorksheetData = {
    ...data,
    id: data.id || `DRAFT-${Date.now()}`,
    saved_at: new Date().toISOString(),
  }
  const filtered = drafts.filter(d => d.id !== record.id)
  filtered.unshift(record)
  localStorage.setItem(SOURCING_DRAFTS_KEY, JSON.stringify(filtered.slice(0, 20)))
  return record
}

export function deleteSourcingDraft(id: string): void {
  const drafts = getSourcingDrafts().filter(d => d.id !== id)
  localStorage.setItem(SOURCING_DRAFTS_KEY, JSON.stringify(drafts))
}

// 6. Autogenerated Sticker Summary Sheet (Excel matching user's exact template)
export async function generateStickerSummaryExcel(data: SourcingWorksheetData): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('SUMMARY SHEET', {
    views: [{ showGridLines: true }]
  })

  const thinSide: ExcelJS.Border = { style: 'thin', color: { argb: 'FF000000' } }
  const thinBorder: Partial<ExcelJS.Borders> = {
    left: thinSide,
    right: thinSide,
    top: thinSide,
    bottom: thinSide,
  }

  const titleFont = { name: 'Calibri', size: 14, bold: true }
  const metaFont = { name: 'Calibri', size: 11, bold: true }
  const hdrFont = { name: 'Calibri', size: 10, bold: true }
  const dataFont = { name: 'Calibri', size: 10 }

  const hdrFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF2F2F2' },
  }

  // 1. Row 1: Merged A1:I1 "SUMMARY SHEET"
  ws.mergeCells('A1:I1')
  const cellA1 = ws.getCell('A1')
  cellA1.value = 'SUMMARY SHEET'
  cellA1.font = titleFont
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 28

  // 2. Metadata Rows 2, 3, 4
  ws.mergeCells('A2:F2')
  const cellA2 = ws.getCell('A2')
  cellA2.value = `Client :${data.client || ''}`
  cellA2.font = metaFont
  cellA2.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(2).height = 20

  ws.mergeCells('A3:F3')
  const cellA3 = ws.getCell('A3')
  cellA3.value = `PO Number: ${data.po_number || ''}`
  cellA3.font = metaFont
  cellA3.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(3).height = 20

  ws.mergeCells('A4:F4')
  const cellA4 = ws.getCell('A4')
  cellA4.value = `MSG Ref:   ${data.msg_ref || ''}`
  cellA4.font = metaFont
  cellA4.alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getRow(4).height = 20

  // Merge G2:I4 for Logo
  ws.mergeCells('G2:I4')
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 9; c++) {
      ws.getRow(r).getCell(c).border = thinBorder
    }
  }

  // Add Logo
  const logoBuf = await fetchLogoBuffer()
  if (logoBuf) {
    try {
      const imgId = wb.addImage({
        buffer: logoBuf,
        extension: 'png',
      })
      ws.addImage(imgId, {
        tl: { col: 6.2, row: 1.15 },
        ext: { width: 155, height: 50 },
      })
    } catch {}
  }

  // 3. Row 5: Column Headers
  const headers = [
    'Item.CF.Client PO Item No',
    'Item Desc',
    'QuantityOrdered',
    'Unit',
    'Heat Number',
    'Make',
    'Certificate Number',
    'Remarks',
    'BAPCO APPROVED TRANSMITTAL NUMBER'
  ]

  ws.getRow(5).height = 26
  headers.forEach((h, idx) => {
    const cell = ws.getRow(5).getCell(idx + 1)
    cell.value = h
    cell.font = hdrFont
    cell.fill = hdrFill
    cell.border = thinBorder
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })

  // 4. Data Rows
  const items = data.items || []
  items.forEach((it, idx) => {
    const rIdx = 6 + idx
    const row = ws.getRow(rIdx)
    row.height = 30

    const rowVals = [
      it.client_po_item_no || String(it.sl_no || idx + 1),
      it.description || '',
      it.qty || 0,
      it.uom || 'Ea',
      it.heat_number || '-',
      it.make || autoDetectMake(it.description) || 'BENKAN, THAILAND',
      it.certificate_number || '-',
      it.remarks || '',
      data.bapco_transmittal || (data.client?.toUpperCase().includes('STS') ? 'TRA-STS-BAP-0157' : '-')
    ]

    rowVals.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1)
      cell.value = val
      cell.font = dataFont
      cell.border = thinBorder
      if ([1, 3, 4, 5, 7, 8, 9].includes(cIdx + 1)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      }
    })
  })

  // Column Widths
  const colWidths = [16, 50, 15, 8, 16, 22, 20, 16, 26]
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w
  })

  const filename = `Summary_Sheet_${(data.po_number || 'BSTSPO').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
  await downloadWorkbook(wb, filename)
}

