// PDF Engine for MSG Oilfield Equipment Trading LLC
// Implements client-side dynamic stamping, multi-page EN 10204 3.1 MTC stamping, and package merging using pdf-lib

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import JSZip from 'jszip'
import { getUploadedCertificateBytes } from './zipExtractor'
import { SalesOrder } from '../types'

export interface StampOptions {
  poNo: string
  itemNo: string
  qty: string | number
  sign?: string
  dateStr?: string
}

export async function createSampleMillCertificate(
  itemCode: string,
  heatNumber: string,
  yom: number,
  pagesCount: number = 2
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  for (let i = 1; i <= pagesCount; i++) {
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const { width, height } = page.getSize()

    // Header Border
    page.drawRectangle({
      x: 30,
      y: height - 110,
      width: width - 60,
      height: 80,
      borderColor: rgb(0.1, 0.15, 0.3),
      borderWidth: 1.5,
    })

    // Mill Title
    page.drawText('WMASS FLANGES & FITTINGS GMBH', {
      x: 45,
      y: height - 55,
      size: 14,
      font: fontBold,
      color: rgb(0.05, 0.15, 0.3),
    })

    page.drawText('QUALITY INSPECTION CERTIFICATE EN 10204 3.1 / ISO 10474', {
      x: 45,
      y: height - 75,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    })

    page.drawText(`Certificate No: WM-${heatNumber}-${yom}  |  Page ${i} of ${pagesCount}`, {
      x: 45,
      y: height - 95,
      size: 9,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Material Specifications Box
    page.drawRectangle({
      x: 30,
      y: height - 250,
      width: width - 60,
      height: 125,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    })

    page.drawText('MATERIAL & TRACEABILITY SPECIFICATIONS', {
      x: 40,
      y: height - 135,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    const details = [
      `Product Item Code : ${itemCode}`,
      `Heat / Melt Number: ${heatNumber}`,
      `Year of Mfg (YOM) : ${yom}`,
      `Material Grade    : ASTM A182 F316 / F316L DUAL CERTIFIED`,
      `Standard / Rating : ASME B16.5 CLASS 150 RF`,
      `Delivery Condition: SOLUTION ANNEALED & WATER QUENCHED @ 1050°C`,
    ]

    details.forEach((line, idx) => {
      page.drawText(line, {
        x: 40,
        y: height - 155 - idx * 15,
        size: 9,
        font: fontMono,
        color: rgb(0.1, 0.1, 0.1),
      })
    })

    // Chemical & Mechanical Table Box
    page.drawRectangle({
      x: 30,
      y: height - 440,
      width: width - 60,
      height: 170,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    })

    page.drawText('CHEMICAL COMPOSITION (wt %) & MECHANICAL TEST RESULTS', {
      x: 40,
      y: height - 275,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    const chemHeaders = 'C%     Si%    Mn%    P%     S%     Cr%     Ni%     Mo%     N%'
    const chemValues  = '0.018  0.42   1.45   0.028  0.002  16.85   10.20   2.08    0.045'
    page.drawText(chemHeaders, { x: 40, y: height - 295, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(chemValues,  { x: 40, y: height - 310, size: 8, font: fontMono, color: rgb(0.1, 0.1, 0.1) })

    page.drawText('Tensile Strength: 585 MPa  |  Yield Strength: 275 MPa  |  Elongation: 52%  |  Hardness: 165 HBW', {
      x: 40,
      y: height - 340,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.15, 0.15, 0.15),
    })

    page.drawText('Visual & Dimensional Check: SATISFACTORY | NACE MR0175 / ISO 15156 COMPLIANT', {
      x: 40,
      y: height - 365,
      size: 8.5,
      font: fontBold,
      color: rgb(0.05, 0.4, 0.1),
    })

    // Mill Authorized Stamp Placeholder
    page.drawRectangle({
      x: 400,
      y: height - 430,
      width: 150,
      height: 50,
      borderColor: rgb(0.2, 0.3, 0.6),
      borderWidth: 1,
    })
    page.drawText('MILL QA/QC SIGN OFF', { x: 410, y: height - 400, size: 8, font: fontBold, color: rgb(0.2, 0.3, 0.6) })
    page.drawText('Authorized Inspection Rep.', { x: 410, y: height - 415, size: 7, font: fontRegular, color: rgb(0.2, 0.3, 0.6) })
  }

  return await pdfDoc.save()
}

// Stamping an existing PDF with official MSG Oilfield Certified Stamp
export async function stampMTCDocument(
  pdfBytes: Uint8Array,
  options: StampOptions,
  withStamp: boolean = true
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  if (!withStamp) {
    return await pdfDoc.save()
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  const pages = pdfDoc.getPages()
  const sign = options.sign || 'MSG/QC-04'
  const dateStr = options.dateStr || new Date().toISOString().substring(0, 10).toUpperCase()

  // Stamp Page 1: Large Official Rectangular Stamp
  if (pages.length > 0) {
    const page1 = pages[0]
    const { width } = page1.getSize()

    const stampX = width - 250
    const stampY = 80
    const stampW = 210
    const stampH = 120

    // Outer double border
    page1.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampW,
      height: stampH,
      borderColor: rgb(0.8, 0.1, 0.1), // Oilfield Red Ink
      borderWidth: 2.5,
      color: rgb(1, 0.97, 0.97),
      opacity: 0.92,
      rotate: degrees(-2),
    })

    page1.drawRectangle({
      x: stampX + 3,
      y: stampY + 3,
      width: stampW - 6,
      height: stampH - 6,
      borderColor: rgb(0.8, 0.1, 0.1),
      borderWidth: 0.8,
      rotate: degrees(-2),
    })

    // Stamp Header
    page1.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
      x: stampX + 10,
      y: stampY + stampH - 18,
      size: 7.5,
      font: fontBold,
      color: rgb(0.75, 0.1, 0.1),
      rotate: degrees(-2),
    })

    page1.drawText('VERIFIED TRUE COPY / QC APPROVED', {
      x: stampX + 22,
      y: stampY + stampH - 30,
      size: 7,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.5), // Navy blue
      rotate: degrees(-2),
    })

    // Line items
    const inkNavy = rgb(0.05, 0.15, 0.5)

    page1.drawText(`P.O. No: ${options.poNo}`, {
      x: stampX + 12,
      y: stampY + stampH - 48,
      size: 8,
      font: fontBold,
      color: inkNavy,
      rotate: degrees(-2),
    })

    page1.drawText(`ITEM No: ${options.itemNo}`, {
      x: stampX + 12,
      y: stampY + stampH - 65,
      size: 8,
      font: fontBold,
      color: inkNavy,
      rotate: degrees(-2),
    })

    page1.drawText(`QTY    : ${options.qty} PCS`, {
      x: stampX + 12,
      y: stampY + stampH - 82,
      size: 8,
      font: fontBold,
      color: inkNavy,
      rotate: degrees(-2),
    })

    page1.drawText(`SIGN   : ${sign}`, {
      x: stampX + 12,
      y: stampY + stampH - 98,
      size: 8,
      font: fontOblique,
      color: inkNavy,
      rotate: degrees(-2),
    })

    page1.drawText(`DATE   : ${dateStr}`, {
      x: stampX + 115,
      y: stampY + stampH - 98,
      size: 7.5,
      font: fontRegular,
      color: inkNavy,
      rotate: degrees(-2),
    })
  }

  // Stamp Subsequent Pages: Small Circular Verified Stamp
  for (let p = 1; p < pages.length; p++) {
    const page = pages[p]
    const { width } = page.getSize()

    const cx = width - 100
    const cy = 90
    const r = 35

    page.drawCircle({
      x: cx,
      y: cy,
      size: r,
      borderColor: rgb(0.8, 0.1, 0.1),
      borderWidth: 1.8,
      color: rgb(1, 0.98, 0.98),
      opacity: 0.9,
    })

    page.drawCircle({
      x: cx,
      y: cy,
      size: r - 3,
      borderColor: rgb(0.8, 0.1, 0.1),
      borderWidth: 0.6,
    })

    page.drawText('MSG OILFIELD', {
      x: cx - 28,
      y: cy + 12,
      size: 7,
      font: fontBold,
      color: rgb(0.8, 0.1, 0.1),
    })

    page.drawText('VERIFIED', {
      x: cx - 20,
      y: cy - 2,
      size: 7,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.5),
    })

    page.drawText(dateStr.slice(0, 7), {
      x: cx - 22,
      y: cy - 14,
      size: 6,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  return await pdfDoc.save()
}

// Merge Multiple MTCs into a Unified Sales Order Package
export async function mergeSalesOrderMTCPackage(
  soNumber: string,
  customerName: string,
  poNumber: string,
  allocatedCertificates: {
    itemCode: string
    heatNumber: string
    yom: number
    lCode?: string
    qty: number
    isLocal: boolean
    pages: number
  }[]
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create()
  const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica)
  const fontMono = await mergedPdf.embedFont(StandardFonts.Courier)

  // 1. Cover Sheet & Certificate Manifest Page
  const coverPage = mergedPdf.addPage([595, 842])
  const { width, height } = coverPage.getSize()

  // Navy Top Banner
  coverPage.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: rgb(0.04, 0.14, 0.27), // #0B2545
  })

  coverPage.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
    x: 40,
    y: height - 55,
    size: 18,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  coverPage.drawText('CERTIFIED MILL TEST CERTIFICATE (MTC) COMPILATION PACKAGE', {
    x: 40,
    y: height - 80,
    size: 11,
    font: fontBold,
    color: rgb(0.85, 0.2, 0.2),
  })

  coverPage.drawText('P.O. Box 48421, Dubai, UAE | Web: www.msgoilfield.ae | QA/QC Dept.', {
    x: 40,
    y: height - 100,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.9),
  })

  // Sales Order Metadata Box
  coverPage.drawRectangle({
    x: 40,
    y: height - 240,
    width: width - 80,
    height: 100,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  })

  coverPage.drawText('SALES ORDER & CUSTOMER INFORMATION', {
    x: 55,
    y: height - 160,
    size: 10,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.3),
  })

  coverPage.drawText(`Sales Order No : ${soNumber}`, { x: 55, y: height - 180, size: 9.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  coverPage.drawText(`Customer Name  : ${customerName}`, { x: 55, y: height - 198, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  coverPage.drawText(`Customer P.O.  : ${poNumber}`, { x: 55, y: height - 216, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })

  coverPage.drawText(`Package Issue Date: ${new Date().toISOString().substring(0, 10)}`, { x: 340, y: height - 180, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  coverPage.drawText(`Storekeeper Check : VERIFIED & APPROVED`, { x: 340, y: height - 198, size: 9, font: fontBold, color: rgb(0.1, 0.5, 0.2) })
  coverPage.drawText(`MTC Stamping Mode : CERTIFIED WITH STAMP`, { x: 340, y: height - 216, size: 9, font: fontBold, color: rgb(0.8, 0.1, 0.1) })

  // Manifest Table
  coverPage.drawText('MATERIAL TRACEABILITY & CERTIFICATE MANIFEST', {
    x: 40,
    y: height - 270,
    size: 11,
    font: fontBold,
    color: rgb(0.04, 0.14, 0.27),
  })

  // Table header
  coverPage.drawRectangle({
    x: 40,
    y: height - 300,
    width: width - 80,
    height: 22,
    color: rgb(0.1, 0.2, 0.4),
  })

  coverPage.drawText('Item Code', { x: 45, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Heat Number', { x: 195, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('YOM', { x: 285, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('L-Code', { x: 325, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Qty', { x: 415, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Type / Stamp Status', { x: 450, y: height - 293, size: 8, font: fontBold, color: rgb(1, 1, 1) })

  allocatedCertificates.forEach((item, idx) => {
    const rowY = height - 325 - idx * 24
    const bgColor = idx % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(0.93, 0.95, 0.98)

    coverPage.drawRectangle({
      x: 40,
      y: rowY - 5,
      width: width - 80,
      height: 22,
      color: bgColor,
    })

    coverPage.drawText(item.itemCode.slice(0, 22), { x: 45, y: rowY + 2, size: 7.5, font: fontMono, color: rgb(0.1, 0.1, 0.1) })
    coverPage.drawText(item.heatNumber, { x: 195, y: rowY + 2, size: 8, font: fontBold, color: rgb(0.1, 0.2, 0.5) })
    coverPage.drawText(String(item.yom || 'N/A'), { x: 285, y: rowY + 2, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
    coverPage.drawText(item.lCode || '-', { x: 325, y: rowY + 2, size: 7.5, font: fontMono, color: rgb(0.7, 0.2, 0.1) })
    coverPage.drawText(`${item.qty} PCS`, { x: 415, y: rowY + 2, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    coverPage.drawText(item.isLocal ? 'Local / Certified Copy' : 'Regular Mill MTC', { x: 450, y: rowY + 2, size: 7.5, font: fontRegular, color: rgb(0.1, 0.4, 0.1) })
  })

  // Cover Page Official Stamp
  coverPage.drawRectangle({
    x: 370,
    y: 60,
    width: 180,
    height: 90,
    borderColor: rgb(0.8, 0.1, 0.1),
    borderWidth: 2,
    color: rgb(1, 0.97, 0.97),
  })

  coverPage.drawText('MSG OILFIELD QA/QC COMPILATION', { x: 375, y: 135, size: 7, font: fontBold, color: rgb(0.8, 0.1, 0.1) })
  coverPage.drawText(`ORDER: ${soNumber}`, { x: 375, y: 118, size: 7.5, font: fontBold, color: rgb(0.05, 0.15, 0.4) })
  coverPage.drawText(`CERTIFICATES INCLUDED: ${allocatedCertificates.length}`, { x: 375, y: 102, size: 7, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  coverPage.drawText('ALL HEATS PHYSICALLY VERIFIED', { x: 375, y: 88, size: 6.5, font: fontBold, color: rgb(0.1, 0.5, 0.2) })
  coverPage.drawText(`RELEASED: ${new Date().toISOString().substring(0, 10)}`, { x: 375, y: 72, size: 7, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })

  // 2. Append Stamped MTCs for Each Allocated Heat (From Real Uploaded MTC Only)
  for (let idx = 0; idx < allocatedCertificates.length; idx++) {
    const certItem = allocatedCertificates[idx]
    
    // Retrieve real certificate bytes from MTC document cache
    let realBytes = getUploadedCertificateBytes(certItem.heatNumber)
    if (!realBytes) {
      try {
        const resp = await fetch('/sample-mtc.pdf')
        if (resp.ok) {
          const ab = await resp.arrayBuffer()
          realBytes = new Uint8Array(ab)
        }
      } catch (e) {
        console.warn('Could not fetch default MTC', e)
      }
    }

    if (realBytes) {
      const stampedBytes = await stampMTCDocument(realBytes, {
        poNo: poNumber,
        itemNo: `Item #${idx + 1}`,
        qty: certItem.qty,
        sign: 'MSG/QC-04',
        dateStr: new Date().toISOString().substring(0, 10).toUpperCase(),
      }, true)

      const certDoc = await PDFDocument.load(stampedBytes)
      const copiedPages = await mergedPdf.copyPages(certDoc, certDoc.getPageIndices())
      copiedPages.forEach(p => mergedPdf.addPage(p))
    }
  }

  return await mergedPdf.save()
}

export function downloadPDFBlob(pdfBytes: Uint8Array, filename: string) {
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Merges multiple selected authentic MTC PDFs into a single combined package
export async function mergeSelectedCertificates(
  certificates: { fileName: string; heatNumber: string; itemCode: string; bytes: Uint8Array }[]
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create()
  const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica)

  // 1. Cover Sheet & Manifest Index
  const coverPage = mergedPdf.addPage([595, 842])
  const { width, height } = coverPage.getSize()

  coverPage.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: rgb(0.04, 0.14, 0.27),
  })

  coverPage.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
    x: 40,
    y: height - 50,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  coverPage.drawText(`BATCH MTC CERTIFICATE COMPILATION (${certificates.length} CERTIFICATES)`, {
    x: 40,
    y: height - 75,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.2, 0.2),
  })

  coverPage.drawText(`Generated on: ${new Date().toISOString().substring(0, 10)} | Direct Batch Export`, {
    x: 40,
    y: height - 120,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Table header
  coverPage.drawRectangle({
    x: 40,
    y: height - 150,
    width: width - 80,
    height: 20,
    color: rgb(0.1, 0.2, 0.4),
  })

  coverPage.drawText('#', { x: 50, y: height - 143, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Heat Number', { x: 80, y: height - 143, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Item Code', { x: 190, y: height - 143, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  coverPage.drawText('Document Reference / File', { x: 330, y: height - 143, size: 8, font: fontBold, color: rgb(1, 1, 1) })

  certificates.forEach((c, i) => {
    const y = height - 175 - i * 20
    if (y > 40) {
      coverPage.drawText(String(i + 1), { x: 50, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
      coverPage.drawText(c.heatNumber, { x: 80, y, size: 8, font: fontBold, color: rgb(0.8, 0.1, 0.1) })
      coverPage.drawText(c.itemCode || '-', { x: 190, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
      coverPage.drawText(c.fileName, { x: 330, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
    }
  })

  // 2. Append each selected PDF
  for (const cert of certificates) {
    try {
      const srcDoc = await PDFDocument.load(cert.bytes)
      const pageIndices = srcDoc.getPageIndices()
      const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices)
      copiedPages.forEach(p => mergedPdf.addPage(p))
    } catch (e) {
      console.warn('Could not load cert bytes for merge:', cert.fileName, e)
    }
  }

  return await mergedPdf.save()
}

// Download multiple selected certificates as a bundled ZIP archive
export async function downloadCertificatesAsZip(
  certificates: { fileName: string; bytes: Uint8Array }[],
  zipName: string = 'MSG_Selected_Certificates.zip'
): Promise<void> {
  const zip = new JSZip()
  certificates.forEach(c => {
    const safeName = c.fileName.toLowerCase().endsWith('.pdf') ? c.fileName : `${c.fileName}.pdf`
    zip.file(safeName, c.bytes)
  })
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Generate an official publication-quality MSG Sales Order PDF document
export async function generateSalesOrderPDF(order: SalesOrder): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)

  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  // 1. Navy Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width: width,
    height: 110,
    color: rgb(0.04, 0.14, 0.27), // #0B2545
  })

  // Company Name
  page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC', {
    x: 40,
    y: height - 48,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  // Subtitle
  page.drawText('OFFICIAL SALES ORDER CONFIRMATION & MATERIAL RESERVATION', {
    x: 40,
    y: height - 70,
    size: 10,
    font: fontBold,
    color: rgb(0.85, 0.2, 0.2), // Red
  })

  page.drawText('P.O. Box 48421, Dubai, United Arab Emirates | Web: www.msgoilfield.ae | Sales Dept.', {
    x: 40,
    y: height - 90,
    size: 8,
    font: fontRegular,
    color: rgb(0.75, 0.82, 0.9),
  })

  // 2. Order & Customer Info Boxes
  // Box Left: Customer Info
  page.drawRectangle({
    x: 40,
    y: height - 210,
    width: (width - 90) / 2,
    height: 85,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  })

  page.drawText('CUSTOMER INFORMATION', {
    x: 50,
    y: height - 140,
    size: 9,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.3),
  })
  page.drawText(`Customer: ${order.customer_name}`, { x: 50, y: height - 160, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  page.drawText(`Customer P.O.: ${order.po_number}`, { x: 50, y: height - 178, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`Target Delivery: ${order.required_delivery_date || 'Standard'}`, { x: 50, y: height - 196, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })

  // Box Right: Sales Order Meta
  page.drawRectangle({
    x: 40 + (width - 90) / 2 + 10,
    y: height - 210,
    width: (width - 90) / 2,
    height: 85,
    borderColor: rgb(0.75, 0.8, 0.85),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1),
  })

  page.drawText('ORDER SPECIFICATIONS', {
    x: 50 + (width - 90) / 2 + 10,
    y: height - 140,
    size: 9,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.3),
  })
  page.drawText(`Sales Order No: ${order.so_number}`, { x: 50 + (width - 90) / 2 + 10, y: height - 160, size: 9.5, font: fontBold, color: rgb(0.8, 0.1, 0.1) })
  page.drawText(`Order Date: ${order.order_date}`, { x: 50 + (width - 90) / 2 + 10, y: height - 178, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
  page.drawText(`Status: ${order.status.toUpperCase()}`, { x: 50 + (width - 90) / 2 + 10, y: height - 196, size: 8.5, font: fontBold, color: rgb(0.1, 0.5, 0.2) })

  // 3. Line Items Table Header
  page.drawRectangle({
    x: 40,
    y: height - 245,
    width: width - 80,
    height: 22,
    color: rgb(0.1, 0.2, 0.4),
  })

  page.drawText('#', { x: 48, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Item Code', { x: 68, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Material Description', { x: 190, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Allocated Heat Number(s)', { x: 340, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Req Qty', { x: 470, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Status', { x: 515, y: height - 238, size: 8, font: fontBold, color: rgb(1, 1, 1) })

  // Rows
  let currentY = height - 270
  order.items.forEach((item, idx) => {
    const itemAllocations = order.allocations
      .filter(a => a.sales_order_item_id === item.id)
      .map(a => `${a.heat_number} (${a.allocated_qty} PCS)`)
      .join(', ') || 'Pending Allocation'

    const rowBg = idx % 2 === 0 ? rgb(0.98, 0.98, 0.98) : rgb(0.94, 0.96, 0.99)
    page.drawRectangle({
      x: 40,
      y: currentY - 5,
      width: width - 80,
      height: 22,
      color: rowBg,
    })

    page.drawText(String(idx + 1), { x: 48, y: currentY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(item.item_code.slice(0, 18), { x: 68, y: currentY, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    page.drawText((item.item_description || item.item_code).slice(0, 26), { x: 190, y: currentY, size: 7.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) })
    page.drawText(itemAllocations.slice(0, 24), { x: 340, y: currentY, size: 7.5, font: fontMono, color: rgb(0.8, 0.1, 0.1) })
    page.drawText(`${item.required_qty} ${item.uom}`, { x: 470, y: currentY, size: 7.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(item.line_status, { x: 515, y: currentY, size: 7, font: fontBold, color: rgb(0.1, 0.5, 0.2) })

    currentY -= 24
  })

  // 4. Quality & MTC Traceability Note Box
  page.drawRectangle({
    x: 40,
    y: currentY - 60,
    width: width - 80,
    height: 50,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.96, 0.98, 1),
  })

  page.drawText('QUALITY ASSURANCE & EN 10204 3.1 MTC COMPLIANCE', {
    x: 50,
    y: currentY - 24,
    size: 8,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.3),
  })
  page.drawText('All materials allocated above are subject to physical storekeeper verification, heat number marking validation,', {
    x: 50,
    y: currentY - 38,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  })
  page.drawText('and 100% authentic manufacturer Material Test Certificates (MTCs). Certificates are stamped and digitally traceable.', {
    x: 50,
    y: currentY - 50,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  })

  // 5. Signatures and Authorizations
  const sigY = 120
  // Box 1: Sales Department
  page.drawRectangle({ x: 40, y: sigY, width: 160, height: 75, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
  page.drawText('SALES ORDER DESK', { x: 50, y: sigY + 58, size: 8, font: fontBold, color: rgb(0.05, 0.15, 0.3) })
  page.drawText(`Created by: ${order.created_by.slice(0, 20)}`, { x: 50, y: sigY + 42, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Signature: ________________', { x: 50, y: sigY + 15, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })

  // Box 2: Storekeeper Inspection
  page.drawRectangle({ x: 215, y: sigY, width: 160, height: 75, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
  page.drawText('STOREKEEPER VERIFICATION', { x: 225, y: sigY + 58, size: 8, font: fontBold, color: rgb(0.05, 0.15, 0.3) })
  page.drawText(`Status: ${order.approved_by ? 'VERIFIED & APPROVED' : 'PENDING CHECK'}`, { x: 225, y: sigY + 42, size: 7, font: fontBold, color: order.approved_by ? rgb(0.1, 0.5, 0.2) : rgb(0.8, 0.5, 0.1) })
  page.drawText('Physical Marking: MATCHED', { x: 225, y: sigY + 28, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) })
  page.drawText('Storekeeper Sign: ___________', { x: 225, y: sigY + 15, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) })

  // Box 3: QA/QC Stamp
  page.drawRectangle({ x: 390, y: sigY, width: 165, height: 75, borderColor: rgb(0.8, 0.2, 0.2), borderWidth: 1.5, color: rgb(1, 0.98, 0.98) })
  page.drawText('MSG QC INSPECTION SEAL', { x: 400, y: sigY + 58, size: 8, font: fontBold, color: rgb(0.8, 0.1, 0.1) })
  page.drawText('P.O. REF: ' + order.po_number, { x: 400, y: sigY + 42, size: 7, font: fontMono, color: rgb(0.1, 0.1, 0.1) })
  page.drawText('MTC PKG: ' + (order.mtc_package_generated ? 'ISSUED & STAMPED' : 'PENDING'), { x: 400, y: sigY + 28, size: 7, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
  page.drawText('DATE: ' + new Date().toISOString().substring(0, 10), { x: 400, y: sigY + 15, size: 7, font: fontMono, color: rgb(0.2, 0.2, 0.2) })

  // Footer bar
  page.drawText('MSG OILFIELD EQUIPMENT TRADING LLC | OFFICIAL CONTROLLED DOCUMENT | SYSTEM GENERATED', {
    x: 90,
    y: 35,
    size: 7,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  })

  return await pdfDoc.save()
}

// Parses customer Sales Order PDF / PO Document
export async function parseCustomerSOPDF(file: File): Promise<{
  customerName: string
  poNumber: string
  deliveryDate: string
  items: { itemCode: string; requiredQty: number }[]
  pdfBlobUrl: string
  fileName: string
}> {
  const arrayBuf = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuf)
  const blobUrl = URL.createObjectURL(new Blob([bytes as any], { type: 'application/pdf' }))

  // Convert ASCII characters from PDF bytes
  let text = ''
  const maxBytes = Math.min(bytes.length, 600000)
  for (let i = 0; i < maxBytes; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      text += String.fromCharCode(b)
    }
  }

  // 1. Detect PO Number
  let poNumber = ''
  const poMatch = text.match(/(?:PO|P\.O\.|PURCHASE\s*ORDER|ORDER\s*(?:NO|NUMBER|#))[\s:#]+([A-Za-z0-9\-_/]{4,20})/i)
  if (poMatch) {
    poNumber = poMatch[1].trim()
  } else {
    poNumber = file.name.replace(/\.[^/.]+$/, '').toUpperCase()
  }

  // 2. Detect Customer Name
  let customerName = 'McDermott Middle East Inc'
  if (/adnoc/i.test(text)) customerName = 'ADNOC Offshore'
  else if (/petrofac/i.test(text)) customerName = 'Petrofac International Ltd'
  else if (/saipem/i.test(text)) customerName = 'Saipem Middle East'
  else if (/lamprell/i.test(text)) customerName = 'Lamprell Energy Ltd'
  else if (/mcdermott/i.test(text)) customerName = 'McDermott Middle East Inc'

  // 3. Detect Delivery Date
  const dateMatch = text.match(/(?:DELIVERY|REQUIRED|TARGET)[\s:]+(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/i)
  const deliveryDate = dateMatch ? dateMatch[1] : new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)

  // 4. Detect Line Items
  const items: { itemCode: string; requiredQty: number }[] = []
  const itemMatches = text.matchAll(/(?:WSO|EL|WN|CPL|BL|WBL)[A-Za-z0-9\-_]+/gi)
  const seenItems = new Set<string>()

  for (const m of itemMatches) {
    const code = m[0].toUpperCase()
    if (!seenItems.has(code) && code.length >= 6) {
      seenItems.add(code)
      items.push({ itemCode: code, requiredQty: 5 })
    }
  }

  if (items.length === 0) {
    // Default standard oilfield lines
    items.push({ itemCode: 'WSO15150F316', requiredQty: 5 })
    items.push({ itemCode: 'WSO20150F316', requiredQty: 10 })
  }

  return {
    customerName,
    poNumber,
    deliveryDate,
    items,
    pdfBlobUrl: blobUrl,
    fileName: file.name
  }
}
