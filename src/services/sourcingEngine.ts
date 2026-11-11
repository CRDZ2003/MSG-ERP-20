// Technical Sourcing, Item Splitting, Dual Excel (Client/Stores) & CIPL Engine
// Integrated from https://github.com/konkanishow-gif/msg123

import * as XLSX from 'xlsx'
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

// 1. Client Summary Sheet (8 Columns: SL NO, CLIENT PO ITEM NO, Description, PO Qty, UOM, Heat Number, Certificate Number, MAKE, Remarks)
export function generateClientSummaryExcel(data: SourcingWorksheetData, filterMachinedOnly: boolean = false): void {
  const items = filterMachinedOnly ? data.items.filter(isMeaningfulItem) : data.items
  const rows: any[] = []

  // Metadata headers
  rows.push(['MSG OILFIELD - SUMMARY SHEET'])
  rows.push([`Client : ${data.client || ''}`])
  rows.push([`PO Number: ${data.po_number || ''}`])
  rows.push([`MSG Ref: ${data.msg_ref || ''}`])
  rows.push([]) // empty row

  // Table Headers
  const headers = [
    'SL NO',
    'CLIENT PO ITEM NO',
    'Description',
    'PO Qty',
    'UOM',
    'Heat Number',
    'Certificate Number',
    'MAKE',
    'Remarks'
  ]
  rows.push(headers)

  // Data Rows
  items.forEach((item, idx) => {
    rows.push([
      item.sl_no || idx + 1,
      item.client_po_item_no || `${idx + 1}`,
      item.description,
      item.qty,
      item.uom || 'PCS',
      item.heat_number || '',
      item.certificate_number || '',
      item.make || '',
      item.remarks || ''
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column Widths
  ws['!cols'] = [
    { wch: 8 },  // SL NO
    { wch: 18 }, // CLIENT PO ITEM NO
    { wch: 65 }, // Description
    { wch: 10 }, // PO Qty
    { wch: 8 },  // UOM
    { wch: 18 }, // Heat Number
    { wch: 20 }, // Certificate Number
    { wch: 22 }, // MAKE
    { wch: 25 }, // Remarks
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'CLIENT_SUMMARY')

  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = `Client_Summary_${safeMsgRef}_${safePo}.xlsx`
  XLSX.writeFile(wb, filename)
}

// 2. Internal Stores Summary Sheet (11 Columns: Includes SUPPLIER NAME, SUPPLIER PO #, Machining)
export function generateStoresSummaryExcel(data: SourcingWorksheetData, filterMachinedOnly: boolean = false): void {
  const items = filterMachinedOnly ? data.items.filter(isMeaningfulItem) : data.items
  const rows: any[] = []

  rows.push(['MSG OILFIELD - STORES SUMMARY SHEET (INTERNAL)'])
  rows.push([`Client : ${data.client || ''}`])
  rows.push([`PO Number: ${data.po_number || ''}`])
  rows.push([`MSG Ref: ${data.msg_ref || ''}`])
  rows.push([])

  const headers = [
    'SL NO',
    'CLIENT PO ITEM NO',
    'Description',
    'PO Qty',
    'UOM',
    'Heat Number',
    'Certificate Number',
    'MAKE',
    'Remarks',
    'SUPPLIER NAME',
    'SUPPLIER PO #'
  ]
  rows.push(headers)

  items.forEach((item, idx) => {
    rows.push([
      item.sl_no || idx + 1,
      item.client_po_item_no || `${idx + 1}`,
      item.description,
      item.qty,
      item.uom || 'PCS',
      item.heat_number || '',
      item.certificate_number || '',
      item.make || '',
      item.remarks || '',
      item.supplier_name || '',
      item.supplier_po_number || ''
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 8 },  // SL NO
    { wch: 18 }, // CLIENT PO ITEM NO
    { wch: 60 }, // Description
    { wch: 10 }, // PO Qty
    { wch: 8 },  // UOM
    { wch: 18 }, // Heat Number
    { wch: 20 }, // Certificate Number
    { wch: 20 }, // MAKE
    { wch: 22 }, // Remarks
    { wch: 25 }, // SUPPLIER NAME
    { wch: 18 }, // SUPPLIER PO #
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'STORES_SUMMARY')

  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = `Internal_Stores_Summary_${safeMsgRef}_${safePo}.xlsx`
  XLSX.writeFile(wb, filename)
}

// 3. Commercial Invoice & Packing List (CIPL) Excel Generator (Two Worksheets)
export function generateCIPLLogisticExcel(data: SourcingWorksheetData): void {
  const currency = (data.currency || 'AED').toUpperCase()
  const invoiceNo = data.invoice_number || (data.msg_ref ? `${data.msg_ref}-CI` : 'INV-2026-CI')
  const dateStr = new Date().toISOString().substring(0, 10)

  // SHEET 1: COMMERCIAL INVOICE
  const invRows: any[] = []
  invRows.push(['MSG OILFIELD EQUIPMENT TRADING LLC'])
  invRows.push(['Dubai Industrial City (DIC) Phase-1, P.O. Box 48421, Dubai, United Arab Emirates'])
  invRows.push(['TRN: 100518964000003 | Email: sales@msgoilfield.ae | Web: www.msgoilfield.ae'])
  invRows.push(['COMMERCIAL INVOICE'])
  invRows.push([])

  invRows.push(['Invoice No:', invoiceNo, '', 'Invoice Date:', dateStr])
  invRows.push(['Customer:', data.client, '', 'Customer PO Ref:', data.po_number])
  invRows.push(['MSG Ref:', data.msg_ref, '', 'Port of Loading:', data.port_of_loading || 'Jebel Ali / Dubai, UAE'])
  invRows.push(['Payment Terms:', data.payment_terms || '30 Days Net', '', 'Port of Discharge:', data.port_of_discharge || 'Destination Port'])
  invRows.push([])

  const invHeaders = [
    'Item #',
    'Client PO Item',
    'Description of Goods',
    'HS Tariff Code',
    'Country of Origin',
    'Qty',
    'UOM',
    `Unit Price (${currency})`,
    `Total Amount (${currency})`
  ]
  invRows.push(invHeaders)

  let grandTotal = 0
  data.items.forEach((item, idx) => {
    const unitPrice = item.unit_price || 50
    const lineTotal = item.qty * unitPrice
    grandTotal += lineTotal

    invRows.push([
      item.sl_no || idx + 1,
      item.client_po_item_no || `${idx + 1}`,
      item.description,
      item.hs_code || autoDetectHSCode(item.description),
      item.country_of_origin || autoDetectCountryOfOrigin(item.make, item.description, item.remarks),
      item.qty,
      item.uom || 'PCS',
      unitPrice,
      lineTotal
    ])
  })

  invRows.push([])
  invRows.push(['', '', '', '', '', '', 'TOTAL INVOICE VALUE:', '', grandTotal])
  invRows.push([`AMOUNT IN WORDS: *** SAY: ${currency} ${numToWords(grandTotal)} ONLY ***`])
  invRows.push([])
  invRows.push(['Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.'])
  invRows.push(['For MSG OILFIELD EQUIPMENT TRADING LLC — Authorized QA/QC Signatory'])

  const wsInvoice = XLSX.utils.aoa_to_sheet(invRows)
  wsInvoice['!cols'] = [
    { wch: 8 },  // Item #
    { wch: 16 }, // Client PO Item
    { wch: 60 }, // Description
    { wch: 15 }, // HS Code
    { wch: 18 }, // Country of Origin
    { wch: 10 }, // Qty
    { wch: 8 },  // UOM
    { wch: 16 }, // Unit Price
    { wch: 18 }, // Total Amount
  ]

  // SHEET 2: PACKING LIST
  const packRows: any[] = []
  packRows.push(['MSG OILFIELD EQUIPMENT TRADING LLC'])
  packRows.push(['Dubai Industrial City (DIC) Phase-1, P.O. Box 48421, Dubai, United Arab Emirates'])
  packRows.push(['OFFICIAL PACKING LIST'])
  packRows.push([])

  packRows.push(['Packing List No:', `${invoiceNo}-PL`, '', 'Date:', dateStr])
  packRows.push(['Customer:', data.client, '', 'Customer PO Ref:', data.po_number])
  packRows.push(['MSG Ref:', data.msg_ref, '', 'Port of Loading:', data.port_of_loading || 'Jebel Ali, UAE'])
  packRows.push([])

  const packHeaders = [
    'Package / Case No',
    'Item #',
    'Description',
    'Qty',
    'UOM',
    'Unit Net Wt (KG)',
    'Total Net Wt (KG)',
    'Total Gross Wt (KG)',
    'Heat Number',
    'Remarks'
  ]
  packRows.push(packHeaders)

  let totalNet = 0
  let totalGross = 0

  data.items.forEach((item, idx) => {
    const unitNet = item.unit_weight_kg || estimateUnitWeight(item.description, item.uom)
    const lineNet = item.total_net_weight_kg || Math.round(item.qty * unitNet * 100) / 100
    const lineGross = item.total_gross_weight_kg || Math.round(lineNet * 1.15 * 100) / 100

    totalNet += lineNet
    totalGross += lineGross

    packRows.push([
      item.package_no || `PKG # ${Math.floor(idx / 3) + 1}`,
      item.sl_no || idx + 1,
      item.description,
      item.qty,
      item.uom || 'PCS',
      unitNet,
      lineNet,
      lineGross,
      item.heat_number || '',
      item.remarks || ''
    ])
  })

  packRows.push([])
  packRows.push(['GRAND TOTALS:', '', '', '', '', '', Math.round(totalNet * 100) / 100, Math.round(totalGross * 100) / 100, '', ''])
  packRows.push([])
  packRows.push(['Total Packages: Sound Sea-Worthy Export Wooden Cases / Crates'])
  packRows.push(['Shipping Marks: MSG / ' + (data.po_number || 'ORDER')])

  const wsPacking = XLSX.utils.aoa_to_sheet(packRows)
  wsPacking['!cols'] = [
    { wch: 18 }, // Package No
    { wch: 8 },  // Item #
    { wch: 60 }, // Description
    { wch: 10 }, // Qty
    { wch: 8 },  // UOM
    { wch: 16 }, // Unit Net Wt
    { wch: 16 }, // Total Net Wt
    { wch: 18 }, // Total Gross Wt
    { wch: 18 }, // Heat Number
    { wch: 20 }, // Remarks
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsInvoice, 'COMMERCIAL_INVOICE')
  XLSX.utils.book_append_sheet(wb, wsPacking, 'PACKING_LIST')

  const safeMsgRef = (data.msg_ref || 'SO').replace(/[\s\/\\:]/g, '_')
  const safePo = (data.po_number || '').replace(/[\s\/\\:]/g, '_')
  const filename = `CIPL_${safeMsgRef}_${safePo}.xlsx`
  XLSX.writeFile(wb, filename)
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
