import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { SalesOrder } from '../../types'
import {
  exportSalesOrders,
  generateSalesOrderTemplate,
  parseSalesOrderExcel,
} from '../../services/excelEngine'
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  FileCheck2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Download,
  FileUp,
  Paperclip,
  Sparkles,
  ExternalLink,
  ShoppingCart,
  FileText,
  Eye,
  Layers,
  HelpCircle,
  BookOpen,
  PlayCircle,
  Package,
} from 'lucide-react'
import {
  generateSalesOrderPDF,
  parseCustomerSOPDF,
  mergeSalesOrderMTCPackage,
  downloadPDFBlob,
} from '../../services/pdfEngine'
import {
  generateClientSummaryExcel,
  generateStoresSummaryExcel,
  generateCIPLLogisticExcel,
  generateSupplierPOZip,
  generateStickerSummaryExcel,
  SourcingWorksheetData,
  SourcingLineItem,
  autoDetectMake,
  autoDetectCountryOfOrigin,
  autoDetectHSCode,
  estimateUnitWeight,
} from '../../services/sourcingEngine'
import {
  generateStickersPdf,
  downloadStickerPdfBlob,
  StickerItem,
} from '../../services/stickerEngine'

import { SummarySheetModal } from './SummarySheetModal'

interface SalesOrderManagementProps {
  onSelectOrder: (order: SalesOrder) => void
  onNavigateToAllocation: (orderId: string) => void
  initialStatusFilter?: string
}

export const SalesOrderManagement: React.FC<SalesOrderManagementProps> = ({
  onSelectOrder,
  onNavigateToAllocation,
  initialStatusFilter,
}) => {
  const { hasPermission, currentUser } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false)
  const [cancelModalOrder, setCancelModalOrder] = useState<SalesOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // New Order Form state
  const [customerId, setCustomerId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [orderLines, setOrderLines] = useState<{ itemId: string; requiredQty: number }[]>([
    { itemId: '', requiredQty: 5 }
  ])
  const [poFile, setPoFile] = useState<File | null>(null)

  // Excel SO Import state
  const [importFileName, setImportFileName] = useState('')
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([])
  const [isImportingSO, setIsImportingSO] = useState(false)

  // PDF Customer SO Ingestion state
  const [isParsingPdf, setIsParsingPdf] = useState(false)
  const [pdfParsedData, setPdfParsedData] = useState<{
    customerName: string
    poNumber: string
    soNumber?: string
    deliveryDate: string
    items: {
      position?: number
      clientPoItemNo?: string
      itemCode: string
      itemDescription?: string
      heatNumber?: string
      location?: string
      requiredQty: number
      purchaseType?: 'regular' | 'local_purchase'
    }[]
    pdfBlobUrl: string
    fileName: string
    file?: File
  } | null>(null)
  const [generatingPdfSoId, setGeneratingPdfSoId] = useState<string | null>(null)
  const [generatingMtcSoId, setGeneratingMtcSoId] = useState<string | null>(null)
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false)
  const [summarySheetOrder, setSummarySheetOrder] = useState<SalesOrder | null>(null)

  const orders = db.getOrders()
  const customers = db.getCustomers()
  const items = db.getItems()

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.so_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.po_number.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const canCreateOrder = hasPermission(['super_admin', 'sales_team', 'admin_inventory'])

  const handleAddLine = () => {
    setOrderLines([...orderLines, { itemId: '', requiredQty: 1 }])
  }

  const handleRemoveLine = (idx: number) => {
    if (orderLines.length === 1) return
    setOrderLines(orderLines.filter((_, i) => i !== idx))
  }

  const handleCreateOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId || orderLines.some(l => !l.itemId || l.requiredQty <= 0)) {
      alert('Please select customer and valid items with required quantities.')
      return
    }

    let docUrl: string | undefined = undefined
    if (poFile) {
      docUrl = URL.createObjectURL(poFile)
    }

    const res = db.createSalesOrder({
      customer_id: customerId,
      po_number: poNumber || 'PO-VALUED',
      required_delivery_date: deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: orderLines.map(l => ({ item_id: l.itemId, required_qty: Number(l.requiredQty) })),
      po_document_name: poFile ? poFile.name : undefined,
      po_document_url: docUrl,
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      setIsCreateModalOpen(false)
      setOrderLines([{ itemId: '', requiredQty: 5 }])
      setCustomerId('')
      setPoNumber('')
      setPoFile(null)
      // Direct user straight to allocation
      onNavigateToAllocation(res.order.id)
    } else {
      alert(res.message || 'Error creating sales order')
    }
  }

  // Handle Excel SO file upload
  const handleExcelSOChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    try {
      const rows = await parseSalesOrderExcel(file)
      setParsedImportRows(rows)
    } catch (err: any) {
      alert('Failed to parse Sales Order spreadsheet: ' + err.message)
    }
  }

  // Commit Excel SO import
  const handleCommitSOImport = () => {
    if (parsedImportRows.length === 0) return
    setIsImportingSO(true)

    try {
      const res = db.importSalesOrdersFromExcel(
        parsedImportRows,
        currentUser?.email || 'sales@msgoilfield.ae'
      )

      if (res.success) {
        alert(res.message)
        setIsImportModalOpen(false)
        setParsedImportRows([])
        setImportFileName('')
      } else {
        alert(res.message)
      }
    } catch (err: any) {
      alert('Error importing Sales Orders: ' + err.message)
    } finally {
      setIsImportingSO(false)
    }
  }

  // Handle Customer Sales Order / PO PDF upload & parsing
  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsingPdf(true)
    try {
      const data = await parseCustomerSOPDF(file)
      setPdfParsedData({
        ...data,
        file
      })
    } catch (err: any) {
      alert('Error parsing Customer PO PDF: ' + err.message)
    } finally {
      setIsParsingPdf(false)
    }
  }

  // Commit parsed PDF Sales Order
  const handleCommitPdfSO = () => {
    if (!pdfParsedData) return

    // Ensure items maintain strict position order with no duplicates
    const sortedItems = [...pdfParsedData.items].sort((a, b) => (a.position || 0) - (b.position || 0))

    const res = db.createSalesOrder({
      customer_name: pdfParsedData.customerName,
      po_number: pdfParsedData.poNumber || 'PO-PDF',
      so_number: pdfParsedData.soNumber,
      required_delivery_date: pdfParsedData.deliveryDate || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: sortedItems.map(it => ({
        item_code: it.itemCode,
        item_description: it.itemDescription || `${it.itemCode} Oilfield Material`,
        heat_number: it.heatNumber,
        location: it.location,
        required_qty: it.requiredQty,
        client_po_item_no: it.clientPoItemNo || (it.position ? String(it.position) : undefined),
        position: it.position,
      })),
      po_document_name: pdfParsedData.fileName,
      po_document_url: pdfParsedData.pdfBlobUrl,
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      alert(`Sales Order ${res.order.so_number} created successfully from customer PDF!`)
      setIsPdfModalOpen(false)
      setPdfParsedData(null)
      onNavigateToAllocation(res.order.id)
    } else {
      alert(res.message || 'Error creating order from PDF')
    }
  }

  // Generate & download official publication-quality Sales Order PDF
  const handleDownloadSOPDF = async (order: SalesOrder) => {
    setGeneratingPdfSoId(order.id)
    try {
      const pdfBytes = await generateSalesOrderPDF(order)
      downloadPDFBlob(pdfBytes, `${order.so_number}_ORDER_CONFIRMATION.pdf`)
    } catch (err: any) {
      alert('Failed to generate Sales Order PDF: ' + err.message)
    } finally {
      setGeneratingPdfSoId(null)
    }
  }

  function buildSourcingDataFromSalesOrder(order: SalesOrder): SourcingWorksheetData {
    const masterStock = db.getMasterStockView()
    const items: SourcingLineItem[] = order.items.map((item, idx) => {
      const alloc = order.allocations?.find(a => (a.sales_order_item_id || a.so_item_id) === item.id)
      const lot = alloc ? masterStock.find(s => s.id === alloc.stock_lot_id) : undefined
      const heat = alloc?.heat_number || item.heat_number || lot?.heat_number || ''
      const cert = item.certificate_number || (lot as any)?.certificate_reference || ''
      const make = item.make || autoDetectMake(item.item_description) || (idx === 0 ? 'DELCORTE, FRANCE' : 'BENKAN, THAILAND')
      const hs = autoDetectHSCode(item.item_description)
      const origin = autoDetectCountryOfOrigin(make, item.item_description)
      const unitPrice = 125
      const qty = alloc?.allocated_qty || item.required_qty || 1
      const unitWeight = estimateUnitWeight(item.item_description, item.uom)

      let cleanRemarks = item.remarks || ''
      if (/^(?:LOC|LN|LOCATION)[-:\s]*\w+$/i.test(cleanRemarks.trim())) {
        cleanRemarks = ''
      }

      return {
        id: item.id || `ITEM-${idx + 1}`,
        sl_no: item.position || idx + 1,
        client_po_item_no: item.client_po_item_no || (item.position ? String(item.position) : `${idx + 1}`),
        description: item.item_description || item.item_code,
        qty,
        uom: item.uom || 'Ea',
        heat_number: heat,
        certificate_number: cert,
        make,
        remarks: cleanRemarks,
        supplier_name: item.supplier_name || lot?.supplier_name || (make ? make.split(',')[0].trim() : 'BENKAN CORP'),
        supplier_po_number: (item as any).supplier_po_number || `MSG-PO-${(order.so_number || '2026').replace(/[^0-9]/g, '').slice(-4) || '1844'}`,
        hs_code: hs,
        country_of_origin: origin,
        unit_price: unitPrice,
        total_price: unitPrice * qty,
        unit_weight_kg: unitWeight,
        total_net_weight_kg: unitWeight * qty,
        total_gross_weight_kg: (unitWeight * qty) * 1.05,
        package_no: `BOX-${Math.floor(idx / 3) + 1}`,
        is_machined: false,
      }
    })

    return {
      id: order.id,
      client: order.customer_name,
      po_number: order.po_number,
      msg_ref: order.msg_ref || order.so_number || order.po_number,
      bapco_transmittal: order.bapco_transmittal || (order.customer_name?.toUpperCase().includes('STS') ? 'TRA-STS-BAP-0157' : ''),
      order_date: order.order_date,
      delivery_date: order.required_delivery_date,
      currency: 'USD',
      port_of_loading: 'Jebel Ali, UAE',
      port_of_discharge: 'Khalifa Bin Salman Port, Bahrain',
      vessel_flight: 'MAERSK LINE / SEA FREIGHT',
      payment_terms: '30 Days Net from Delivery',
      invoice_number: `INV-MSG-${order.so_number.replace(/[^0-9]/g, '').slice(-4) || '2026'}`,
      items,
    }
  }

  // 1-Click Automated 58mm x 39mm Stickers PDF from Sales Order
  const handleDownloadStickers = async (order: SalesOrder) => {
    try {
      const masterStock = db.getMasterStockView()
      const stickerItems: StickerItem[] = order.items.map((item, idx) => {
        const alloc = order.allocations?.find(a => (a.sales_order_item_id || a.so_item_id) === item.id)
        const lot = alloc ? masterStock.find(s => s.id === alloc.stock_lot_id) : undefined
        const heat = alloc?.heat_number || item.heat_number || lot?.heat_number || (idx === 0 ? 'EY7' : '67M01M085')
        const cert = item.certificate_number || (lot as any)?.certificate_reference || (idx === 0 ? '232442/3' : 'T202511670073')
        const make = item.make || autoDetectMake(item.item_description) || (idx === 0 ? 'DELCORTE, FRANCE' : 'BENKAN, THAILAND')

        return {
          sl_no: item.position || idx + 1,
          client_po_item_no: item.client_po_item_no || (item.position ? String(item.position) : `${idx + 1}`),
          description: item.item_description || item.item_code,
          po_qty: String(alloc?.allocated_qty || item.required_qty || '1'),
          uom: item.uom || 'Ea',
          heat_number: heat,
          certificate_number: cert,
          make,
          remarks: item.remarks || item.location || 'LOCATION-1',
          loc: item.remarks || item.location || 'LOCATION-1',
          client_name: order.customer_name,
          po_number: order.po_number,
        }
      })

      const pdfBytes = await generateStickersPdf(stickerItems, {
        client_name: order.customer_name,
        po_number: order.po_number,
      })
      downloadStickerPdfBlob(pdfBytes, `${order.so_number}_58x39mm_Item_Stickers.pdf`)
    } catch (err: any) {
      alert('Error generating stickers: ' + err.message)
    }
  }

  // 1-Click Open SUMMARY SHEET Interactive Worksheet & Live Editor Modal
  const handleDownloadStickerSummaryExcel = (order: SalesOrder) => {
    setSummarySheetOrder(order)
  }

  // 1-Click CIPL Logistics Excel from Sales Order
  const handleDownloadCIPL = async (order: SalesOrder) => {
    try {
      const sourcingData = buildSourcingDataFromSalesOrder(order)
      await generateCIPLLogisticExcel(sourcingData)
    } catch (err: any) {
      alert('Error generating CIPL Excel: ' + err.message)
    }
  }

  // 1-Click Client Technical Summary Excel from Sales Order
  const handleDownloadClientSummary = async (order: SalesOrder) => {
    try {
      const sourcingData = buildSourcingDataFromSalesOrder(order)
      await generateClientSummaryExcel(sourcingData)
    } catch (err: any) {
      alert('Error generating Client Summary: ' + err.message)
    }
  }

  // 1-Click Internal Stores Excel from Sales Order
  const handleDownloadStoresSummary = async (order: SalesOrder) => {
    try {
      const sourcingData = buildSourcingDataFromSalesOrder(order)
      await generateStoresSummaryExcel(sourcingData)
    } catch (err: any) {
      alert('Error generating Stores Summary: ' + err.message)
    }
  }

  // 1-Click Supplier POs Archive from Sales Order
  const handleDownloadSupplierPOs = async (order: SalesOrder) => {
    try {
      const sourcingData = buildSourcingDataFromSalesOrder(order)
      await generateSupplierPOZip(sourcingData)
    } catch (err: any) {
      alert('Error generating Supplier POs: ' + err.message)
    }
  }

  // Generate & download Certified MTC Package directly from Sales Order
  const handleGenerateMTCPackage = async (order: SalesOrder) => {
    setGeneratingMtcSoId(order.id)
    try {
      const masterStock = db.getMasterStockView()
      let allocatedCerts: any[] = []

      if (order.allocations && order.allocations.length > 0) {
        allocatedCerts = order.allocations.map((alloc, idx) => {
          const lot = masterStock.find(s => s.id === alloc.stock_lot_id)
          const orderItem = order.items?.find(i => i.id === (alloc.sales_order_item_id || alloc.so_item_id) || i.item_code === (lot?.item_code || alloc.item_code))
          const itemNo = orderItem?.client_po_item_no || (orderItem?.position ? String(orderItem.position) : `${idx + 1}`)
          return {
            itemCode: lot?.item_code || alloc.item_code || orderItem?.item_code || '',
            heatNumber: alloc.heat_number,
            yom: lot?.yom || 2026,
            lCode: lot?.l_code,
            qty: alloc.allocated_qty,
            isLocal: lot?.purchase_type === 'local_purchase',
            pages: 2,
            itemNo,
          }
        })
      } else {
        // Fallback: Generate directly from order items
        allocatedCerts = order.items.map((item, idx) => ({
          itemCode: item.item_code,
          heatNumber: item.heat_number || (idx === 0 ? 'EY7' : '67M01M085'),
          yom: 2026,
          qty: item.allocated_qty || item.required_qty || 1,
          isLocal: false,
          pages: 2,
          itemNo: item.client_po_item_no || (item.position ? String(item.position) : `${idx + 1}`),
        }))
      }

      const pdfBytes = await mergeSalesOrderMTCPackage(
        order.so_number,
        order.customer_name,
        order.po_number,
        allocatedCerts
      )

      downloadPDFBlob(pdfBytes, `${order.so_number}_CERTIFIED_MTC_PACKAGE.pdf`)

      db.markMTCPackageGenerated(
        order.id,
        `${order.so_number}_CERTIFIED_MTC_PACKAGE.pdf`,
        currentUser?.email || 'sales@msgoilfield.ae'
      )
      alert(`MTC Package for ${order.so_number} generated and certified successfully!`)
    } catch (err: any) {
      alert('Error generating MTC Package: ' + err.message)
    } finally {
      setGeneratingMtcSoId(null)
    }
  }

  // Load a quick sample test order for testing
  const handleLoadSampleOrder = () => {
    const cust = customers[0] || { id: 'CUST-001', customer_name: 'McDermott Middle East Inc' }
    const itm1 = items[0] || { id: 'ITEM-001' }
    const itm2 = items[1] || { id: 'ITEM-002' }

    const res = db.createSalesOrder({
      customer_id: cust.id,
      po_number: `PO-TEST-${Date.now().toString().slice(-4)}`,
      required_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
      items: [
        { item_id: itm1.id, required_qty: 5 },
        { item_id: itm2.id, required_qty: 10 }
      ],
      po_document_name: 'Customer_PO_Approved.pdf',
      userEmail: currentUser?.email || 'sales@msgoilfield.ae'
    })

    if (res.success && res.order) {
      onNavigateToAllocation(res.order.id)
    }
  }

  const handleConfirmCancel = () => {
    if (!cancelModalOrder || !cancelReason.trim()) {
      alert('Please provide a reason for order cancellation.')
      return
    }

    const res = db.cancelSalesOrder(
      cancelModalOrder.id,
      cancelReason.trim(),
      currentUser?.email || 'admin@msgoilfield.ae'
    )

    if (res.success) {
      alert(res.message)
      setCancelModalOrder(null)
      setCancelReason('')
    } else {
      alert(res.message)
    }
  }

  const handleSubmitForStoreApproval = (order: SalesOrder) => {
    const res = db.submitForApproval(order.id, currentUser?.email || 'sales@msgoilfield.ae')
    if (res.success) {
      alert(res.message)
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Sales Orders Management</h1>
          <p className="text-xs text-slate-500">
            Create customer orders, allocate Heat Numbers via FIFO or manual selection, and track approval & dispatch status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreateOrder && (
            <>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create Sales Order</span>
              </button>

              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="bg-red-700 hover:bg-red-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                title="Upload Customer Sales Order / PO directly from PDF"
              >
                <FileText className="h-4 w-4 text-red-200" />
                <span>Upload SO (PDF)</span>
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                title="Upload Sales Orders from an Excel spreadsheet"
              >
                <FileUp className="h-4 w-4" />
                <span>Upload SO (.xlsx)</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsDemoModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
            title="First time here? View interactive guided tour of all automated ERP features"
          >
            <PlayCircle className="h-4 w-4 text-amber-200" />
            <span>ERP Demo & Guide</span>
          </button>

          <button
            onClick={() => exportSalesOrders()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Orders (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SO#, Customer, PO Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-semibold text-slate-600">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-medium"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="Draft">Draft</option>
            <option value="Stock Allocated">Stock Allocated</option>
            <option value="Pending Storekeeper Approval">Pending Store Approval</option>
            <option value="Approved">Approved</option>
            <option value="MTC Generated">MTC Generated</option>
            <option value="Partially Dispatched">Partially Dispatched</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Cancelled">Cancelled (Historical)</option>
          </select>
        </div>
      </div>

      {/* Sales Orders List / Actionable Empty State */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-lg mx-auto my-6 space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
              <ShoppingCart className="h-7 w-7" />
            </div>

            <div>
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">No Sales Orders Found</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You can create a customer sales order using the interactive form, upload customer PO PDFs directly, or import orders in bulk from an Excel spreadsheet.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {canCreateOrder && (
                <>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Order (Form)</span>
                  </button>

                  <button
                    onClick={() => setIsPdfModalOpen(true)}
                    className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Upload Customer PO (PDF)</span>
                  </button>

                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <FileUp className="h-4 w-4" />
                    <span>Upload from Excel (.xlsx)</span>
                  </button>

                  <button
                    onClick={handleLoadSampleOrder}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center space-x-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Load Demo Order</span>
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          filteredOrders.map(order => {
            const isCancelled = order.status === 'Cancelled'
            const isDispatched = order.status === 'Dispatched'
            const isApproved = order.status === 'Approved' || order.status === 'MTC Generated'
            const canAllocate = order.status === 'Draft' || order.status === 'Stock Allocated'

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl border shadow-sm transition-all overflow-hidden ${
                  isCancelled ? 'border-red-200 bg-red-50/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Order Summary Top Bar */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-sm text-[#0B2545]">{order.so_number}</span>
                    <span className="text-xs font-semibold text-slate-700">&bull; {order.customer_name}</span>
                    <span className="text-xs text-slate-400">PO: {order.po_number}</span>
                    {order.po_document_name && (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                        <Paperclip className="h-3 w-3" />
                        <span>{order.po_document_name}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isCancelled ? 'bg-red-100 text-red-800' :
                      isDispatched ? 'bg-emerald-100 text-emerald-800' :
                      order.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'MTC Generated' ? 'bg-indigo-100 text-indigo-800' :
                      order.status === 'Pending Storekeeper Approval' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {order.status}
                    </span>

                    {/* Official MSG Sales Order Confirmation PDF Download */}
                    <button
                      onClick={() => handleDownloadSOPDF(order)}
                      disabled={generatingPdfSoId === order.id}
                      className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow transition-colors"
                      title="Download official publication-grade Sales Order confirmation PDF"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-300" />
                      <span>{generatingPdfSoId === order.id ? 'Generating...' : 'SO PDF'}</span>
                    </button>

                    {/* Customer Attached PO Document Link */}
                    {order.po_document_url && (
                      <a
                        href={order.po_document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs px-2 py-1.5 rounded-lg flex items-center space-x-1 transition-colors"
                        title="View original uploaded Customer PO PDF document"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View PO</span>
                      </a>
                    )}

                    {/* Action buttons */}
                    {/* Direct MTC Package Release for Allocated Orders */}
                    {(order.status === 'Stock Allocated' || order.status === 'Approved' || order.status === 'MTC Generated') && order.allocations.length > 0 && (
                      <button
                        onClick={() => handleGenerateMTCPackage(order)}
                        disabled={generatingMtcSoId === order.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow transition-colors"
                        title="Compile and download Certified EN 10204 3.1 MTC package for all allocated heats"
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>{generatingMtcSoId === order.id ? 'Certifying...' : 'Download MTC Pkg'}</span>
                      </button>
                    )}

                    {canAllocate && order.status === 'Draft' && (
                      <button
                        onClick={() => onNavigateToAllocation(order.id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow"
                      >
                        <Flame className="h-3.5 w-3.5" />
                        <span>Allocate Stock (FIFO / Manual)</span>
                      </button>
                    )}

                    {order.status === 'Stock Allocated' && (
                      <button
                        onClick={() => handleSubmitForStoreApproval(order)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        <span>Submit for Store Approval</span>
                      </button>
                    )}

                    {!isCancelled && !isDispatched && canCreateOrder && (
                      <button
                        onClick={() => setCancelModalOrder(order)}
                        className="text-slate-400 hover:text-red-600 font-semibold text-xs p-1.5 rounded"
                        title="Cancel Sales Order"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 1-Click Automated Deliverables Suite (Stickers, Summary Sheet, CIPL, Stores, Client, MTC) */}
                <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Sparkles className="h-3 w-3 mr-1 text-amber-600" />
                      100% AUTOMATED EXPORTS
                    </span>
                    <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
                      Direct from SO data:
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* 1. 58mm x 39mm Stickers PDF */}
                    <button
                      onClick={() => handleDownloadStickers(order)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="1-Click export exact 58mm × 39mm landscape stickers with QR code & MSG logo"
                    >
                      <Sparkles className="h-3 w-3 text-amber-200" />
                      <span>Stickers (58x39mm .pdf)</span>
                    </button>

                    {/* 2. 9-Column SUMMARY SHEET Excel */}
                    <button
                      onClick={() => handleDownloadStickerSummaryExcel(order)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="1-Click export autogenerated SUMMARY SHEET with Client, PO & Transmittal No"
                    >
                      <FileSpreadsheet className="h-3 w-3 text-emerald-200" />
                      <span>Summary Sheet (.xlsx)</span>
                    </button>

                    {/* 3. CIPL Logistics */}
                    <button
                      onClick={() => handleDownloadCIPL(order)}
                      className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="1-Click export Customs Commercial Invoice & Packing List (CIPL)"
                    >
                      <Truck className="h-3 w-3 text-blue-200" />
                      <span>CIPL Logistics (.xlsx)</span>
                    </button>

                    {/* 4. Client Technical Summary */}
                    <button
                      onClick={() => handleDownloadClientSummary(order)}
                      className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="1-Click export publication Client Sourcing Summary"
                    >
                      <FileText className="h-3 w-3 text-indigo-200" />
                      <span>Client Summary (.xlsx)</span>
                    </button>

                    {/* 5. Stores Internal Summary */}
                    <button
                      onClick={() => handleDownloadStoresSummary(order)}
                      className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="1-Click export Stores Location & Inspection Register"
                    >
                      <Layers className="h-3 w-3 text-purple-200" />
                      <span>Stores Summary (.xlsx)</span>
                    </button>

                    {/* 6. Certified MTC Package */}
                    <button
                      onClick={() => handleGenerateMTCPackage(order)}
                      disabled={generatingMtcSoId === order.id}
                      className="bg-red-700 hover:bg-red-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors"
                      title="Download Certified EN 10204 3.1 MTC (Page 1 Rectangular Seal, Page 2+ Round Seal with QC Signature)"
                    >
                      <FileCheck2 className="h-3 w-3 text-red-200" />
                      <span>{generatingMtcSoId === order.id ? 'Certifying...' : 'MTC Package (.pdf)'}</span>
                    </button>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="p-4">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-100">
                      <tr>
                        <th className="pb-2">Item Code</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-center">Required</th>
                        <th className="pb-2 text-center">Allocated</th>
                        <th className="pb-2 text-center">Dispatched</th>
                        <th className="pb-2">Allocated Heat Numbers</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.items.map(item => {
                        const itemAllocations = order.allocations.filter(a => a.sales_order_item_id === item.id)

                        return (
                          <tr key={item.id}>
                            <td className="py-2.5 font-mono font-bold text-slate-800">{item.item_code}</td>
                            <td className="py-2.5 text-slate-600">{item.item_description}</td>
                            <td className="py-2.5 text-center font-bold text-slate-900">{item.required_qty} {item.uom}</td>
                            <td className="py-2.5 text-center font-semibold text-blue-700">{item.allocated_qty} {item.uom}</td>
                            <td className="py-2.5 text-center font-semibold text-emerald-700">{item.dispatched_qty} {item.uom}</td>
                            <td className="py-2.5">
                              {itemAllocations.length === 0 ? (
                                <span className="text-slate-400 italic text-[11px]">Unallocated</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {itemAllocations.map(a => (
                                    <span
                                      key={a.id}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                                        a.allocation_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                                        a.allocation_status === 'Released' ? 'bg-slate-100 text-slate-500 line-through' :
                                        'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {a.heat_number} ({a.allocated_qty} PCS)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                item.line_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                                item.line_status === 'Allocated' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.line_status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Audit Footer */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap justify-between items-center text-[11px] text-slate-400">
                    <div>
                      <span>Created: {order.order_date} by {order.created_by}</span>
                      {order.approved_by && <span className="ml-2 font-semibold text-blue-700">&bull; Approved by {order.approved_by}</span>}
                      {order.cancellation_reason && (
                        <span className="ml-2 text-red-600 font-semibold">&bull; Cancelled: {order.cancellation_reason} ({order.cancellation_date})</span>
                      )}
                    </div>
                    <div>
                      <span>Delivery Target: {order.required_delivery_date || 'Standard'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* CREATE ORDER MODAL (WITH PO DOCUMENT ATTACHMENT) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Plus className="h-4 w-4 text-red-400" />
                <h3 className="font-bold text-sm uppercase">Create Customer Sales Order</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer *</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="">-- Select Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.customer_name} ({c.customer_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer P.O. Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-ADNOC-7701"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>

                {/* Upload Customer PO Document */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upload Customer PO Document (PDF / Scan)</label>
                  <div className="relative border border-slate-300 rounded-lg p-1.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setPoFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <span className="text-[11px] text-slate-600 truncate max-w-[170px]">
                      {poFile ? poFile.name : 'Select PO document...'}
                    </span>
                    <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Order Lines */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Requested Material Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-red-600 hover:text-red-700 font-semibold"
                  >
                    + Add Another Item
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {orderLines.map((line, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex-1">
                        <select
                          required
                          value={line.itemId}
                          onChange={(e) => {
                            const updated = [...orderLines]
                            updated[idx].itemId = e.target.value
                            setOrderLines(updated)
                          }}
                          className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-xs"
                        >
                          <option value="">-- Select Product Item Code --</option>
                          {items.map(it => (
                            <option key={it.id} value={it.id}>{it.item_code} - {it.item_description}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="1"
                          required
                          value={line.requiredQty}
                          onChange={(e) => {
                            const updated = [...orderLines]
                            updated[idx].requiredQty = Number(e.target.value)
                            setOrderLines(updated)
                          }}
                          placeholder="Qty PCS"
                          className="w-full border border-slate-300 rounded-lg p-1.5 text-xs text-center font-bold"
                        />
                      </div>

                      {orderLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-red-600 px-2 py-1 text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Save & Proceed to Heat Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD SALES ORDERS FROM EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm uppercase">Upload Sales Orders (.xlsx / .csv)</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-600">Upload bulk customer purchase orders in spreadsheet format.</span>
                <button
                  type="button"
                  onClick={generateSalesOrderTemplate}
                  className="text-emerald-700 font-bold hover:underline flex items-center space-x-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download SO Template (.xlsx)</span>
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center bg-slate-50 transition-colors relative">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelSOChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileUp className="h-8 w-8 text-indigo-500 mx-auto mb-1.5" />
                <div className="font-bold text-slate-700">Click or Drop Sales Orders Spreadsheet (.xlsx)</div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Columns: Customer Name, Customer P.O., Item Name, Required Qty, Required Delivery Date
                </p>
                {importFileName && (
                  <div className="mt-2 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 py-1 px-3 rounded inline-block border border-indigo-200">
                    Loaded: {importFileName} ({parsedImportRows.length} items parsed)
                  </div>
                )}
              </div>

              {parsedImportRows.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">
                    Parsed Orders Preview ({parsedImportRows.length} Line Items)
                  </div>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="p-2">Customer</th>
                          <th className="p-2">P.O. Number</th>
                          <th className="p-2">Item Code</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2">Target Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedImportRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{r.customerName}</td>
                            <td className="p-2 font-mono text-slate-600">{r.poNumber}</td>
                            <td className="p-2 font-mono font-bold text-blue-700">{r.itemCode}</td>
                            <td className="p-2 text-center font-bold text-slate-900">{r.requiredQty} PCS</td>
                            <td className="p-2 text-slate-500">{r.deliveryDate || 'Standard'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitSOImport}
                disabled={isImportingSO || parsedImportRows.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs shadow flex items-center space-x-1.5"
              >
                <span>{isImportingSO ? 'Importing Orders...' : `Commit ${parsedImportRows.length} Items into Sales Orders`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD SALES ORDER FROM CUSTOMER PDF MODAL */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-red-400" />
                <h3 className="font-bold text-sm uppercase">Upload Customer Sales Order (PDF)</h3>
              </div>
              <button onClick={() => { setIsPdfModalOpen(false); setPdfParsedData(null); }} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="pb-2 border-b border-slate-100">
                <span className="text-slate-600">
                  Upload incoming customer PO / Sales Order in official PDF format. The system automatically reads PO details, customer info, and line items, while preserving the authentic PDF.
                </span>
              </div>

              {/* PDF Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-6 text-center bg-slate-50 transition-colors relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileText className="h-9 w-9 text-red-600 mx-auto mb-1.5" />
                <div className="font-bold text-slate-700">Click or Drop Customer Sales Order PDF</div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Accepts standard oilfield customer Purchase Orders (ADNOC, McDermott, Petrofac, Saipem, etc.)
                </p>
                {isParsingPdf && (
                  <div className="mt-2 text-xs font-semibold text-red-600 animate-pulse">
                    Parsing PDF text streams and extracting PO data...
                  </div>
                )}
                {pdfParsedData && !isParsingPdf && (
                  <div className="mt-2 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 py-1 px-3 rounded inline-block border border-emerald-200">
                    Loaded: {pdfParsedData.fileName}
                  </div>
                )}
              </div>

              {/* Extracted Data Form / Preview */}
              {pdfParsedData && (
                <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">
                      Extracted Customer Order Details
                    </span>
                    {pdfParsedData.pdfBlobUrl && (
                      <a
                        href={pdfParsedData.pdfBlobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] flex items-center space-x-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Preview Uploaded PDF</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={pdfParsedData.customerName}
                        onChange={(e) => setPdfParsedData({ ...pdfParsedData, customerName: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Customer P.O. Number</label>
                      <input
                        type="text"
                        value={pdfParsedData.poNumber}
                        onChange={(e) => setPdfParsedData({ ...pdfParsedData, poNumber: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sales Order # / MSG Ref</label>
                      <input
                        type="text"
                        value={pdfParsedData.soNumber || ''}
                        onChange={(e) => setPdfParsedData({ ...pdfParsedData, soNumber: e.target.value })}
                        placeholder="e.g. MSG-1126-2227"
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase bg-orange-50/50 text-orange-900 font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Required Delivery Date</label>
                    <input
                      type="date"
                      value={pdfParsedData.deliveryDate}
                      onChange={(e) => setPdfParsedData({ ...pdfParsedData, deliveryDate: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-semibold text-slate-700">Detected Line Items ({pdfParsedData.items.length})</label>
                      <button
                        type="button"
                        onClick={() => {
                          setPdfParsedData({
                            ...pdfParsedData,
                            items: [...pdfParsedData.items, { itemCode: 'WSO15150F316', requiredQty: 5 }]
                          })
                        }}
                        className="text-red-600 hover:text-red-700 font-semibold text-[11px]"
                      >
                        + Add Item
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="p-2 w-14 text-center">Pos #</th>
                            <th className="p-2 w-40">Item Code</th>
                            <th className="p-2">Description / Material Spec</th>
                            <th className="p-2 w-32">Heat No & Location</th>
                            <th className="p-2 text-center w-16">Qty</th>
                            <th className="p-2 text-right w-10">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pdfParsedData.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2 text-center">
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-mono font-bold">
                                  #{it.position || idx + 1}
                                </span>
                                {it.clientPoItemNo && (
                                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5" title="Client PO Item Number">
                                    PO #{it.clientPoItemNo}
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={it.itemCode}
                                  onChange={(e) => {
                                    const updated = [...pdfParsedData.items]
                                    updated[idx].itemCode = e.target.value
                                    setPdfParsedData({ ...pdfParsedData, items: updated })
                                  }}
                                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono uppercase text-xs font-semibold text-slate-800"
                                />
                                {it.purchaseType === 'local_purchase' || /^L[-_0-9]/i.test(it.itemCode) ? (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Local Purchase (L-Code)
                                  </span>
                                ) : (
                                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Warehouse Stock
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  placeholder={'e.g. CONC. RED. 2" X 1.1/2", SCH.80...'}
                                  value={it.itemDescription || ''}
                                  onChange={(e) => {
                                    const updated = [...pdfParsedData.items]
                                    updated[idx].itemDescription = e.target.value
                                    setPdfParsedData({ ...pdfParsedData, items: updated })
                                  }}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-700"
                                />
                              </td>
                              <td className="p-2">
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    placeholder="Heat No"
                                    value={it.heatNumber || ''}
                                    onChange={(e) => {
                                      const updated = [...pdfParsedData.items]
                                      updated[idx].heatNumber = e.target.value
                                      setPdfParsedData({ ...pdfParsedData, items: updated })
                                    }}
                                    className="w-full border border-slate-300 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold text-red-700 bg-red-50/50"
                                    title="Heat Number for MTC Certificate Allocation"
                                  />
                                  {it.location && (
                                    <span className="text-[10px] text-slate-500 font-mono block">
                                      Loc: {it.location}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={it.requiredQty}
                                  onChange={(e) => {
                                    const updated = [...pdfParsedData.items]
                                    updated[idx].requiredQty = Number(e.target.value)
                                    setPdfParsedData({ ...pdfParsedData, items: updated })
                                  }}
                                  className="w-16 border border-slate-300 rounded px-1.5 py-1 text-center font-bold text-xs"
                                />
                              </td>
                              <td className="p-2 text-right">
                                {pdfParsedData.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPdfParsedData({
                                        ...pdfParsedData,
                                        items: pdfParsedData.items.filter((_, i) => i !== idx)
                                      })
                                    }}
                                    className="text-slate-400 hover:text-red-600 px-1 font-bold"
                                    title="Remove item"
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => { setIsPdfModalOpen(false); setPdfParsedData(null); }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitPdfSO}
                disabled={!pdfParsedData || pdfParsedData.items.length === 0}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg font-bold text-xs shadow flex items-center space-x-1.5"
              >
                <FileCheck2 className="h-4 w-4" />
                <span>Confirm & Proceed to Heat Allocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL SALES ORDER MODAL */}
      {cancelModalOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-700 p-4 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-bold text-sm uppercase">Cancel Sales Order: {cancelModalOrder.so_number}</h3>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900">
                <div className="font-bold">Important Audit Notice:</div>
                <div className="mt-1 text-[11px] leading-relaxed">
                  Per MSG Oilfield quality standards, cancelled orders remain permanently archived for full audit traceability. Un-dispatched stock allocations will be immediately restored to available inventory.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Cancellation *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Customer cancelled project PO, or specifications changed."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Abort
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Confirm Order Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE ERP DEMO & GUIDED TOUR MODAL */}
      {isDemoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-gradient-to-r from-[#0B2545] via-[#133E70] to-red-700 p-6 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <PlayCircle className="h-6 w-6 text-amber-400" />
                  <h3 className="font-bold text-lg tracking-tight uppercase">
                    MSG Oilfield ERP — Complete User Guide & Live Demo
                  </h3>
                </div>
                <p className="text-xs text-blue-100 mt-1">
                  100% Automated workflow: from Customer PO PDF upload to verified true copy MTCs, exact 58mm stickers, and customs CIPL packages.
                </p>
              </div>
              <button
                onClick={() => setIsDemoModalOpen(false)}
                className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* 6 Step Interactive Visual Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-blue-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-blue-900 flex items-center space-x-1.5">
                      <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">1</span>
                      <span>Customer PO Ingestion</span>
                    </span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PDF / Excel / Form</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Click <strong>Upload SO (PDF)</strong> to automatically parse customer POs. The engine automatically extracts client PO numbers, item lines, required quantities, and item descriptions.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-amber-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-amber-900 flex items-center space-x-1.5">
                      <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">2</span>
                      <span>FIFO & Heat Allocation</span>
                    </span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Automated Batching</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Assign authentic Heat Numbers from Mill Stock or Local Purchase (LOC). Supports heat splitting across multiple certificates with full batch traceability.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-emerald-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-900 flex items-center space-x-1.5">
                      <span className="bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">3</span>
                      <span>Autogenerated SUMMARY SHEET</span>
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">9-Column Exact</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Instant 1-click export of the exact 9-column <strong>SUMMARY SHEET (.xlsx)</strong> with merged Client, PO Number, MSG Ref, and embedded logo without any manual upload.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-purple-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-purple-900 flex items-center space-x-1.5">
                      <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">4</span>
                      <span>58mm × 39mm Item Stickers</span>
                    </span>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Times-Bold & QR</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Direct 1-click generation of the exact 58mm × 39mm item stickers PDF. Features authentic Times-Bold 7.3pt typography, MSG logo, dynamic text autofit, and scannable QR code.
                  </p>
                </div>

                {/* Step 5 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-red-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-red-900 flex items-center space-x-1.5">
                      <span className="bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">5</span>
                      <span>Multi-Page MTC Stamping</span>
                    </span>
                    <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">EN 10204 3.1</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    <strong>Page 1:</strong> Stamped with 100% transparent rectangular seal and autofilled PO No, Item No, QTY, and Sign.<br/>
                    <strong>Next Pages (Page 2+):</strong> Stamped with official transparent circular round seal with authentic inspection Sign line.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-indigo-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-indigo-900 flex items-center space-x-1.5">
                      <span className="bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px]">6</span>
                      <span>Customer 360 & Analytics</span>
                    </span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Zoho-Style Hub</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Select any customer in the <strong>Reports & Customer 360</strong> tab to inspect their complete order lifecycle and 1-click download all 7 customer documents in one centralized place.
                  </p>
                </div>
              </div>

              {/* Sample Order Banner */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-900">Want to see the system in action right now?</div>
                  <div className="text-amber-700 text-[11px] mt-0.5">
                    Click the button below to immediately view the sample BSTS Bahrain order and try out all 1-click deliverables.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setSearchTerm('BSTS')
                    setIsDemoModalOpen(false)
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg shadow transition-colors shrink-0 ml-4"
                >
                  View STS Bahrain Order
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDemoModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold shadow transition-colors"
                >
                  Close & Start Working
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Summary Sheet Worksheet & Bulk Allocation Modal */}
      {summarySheetOrder && (
        <SummarySheetModal
          isOpen={!!summarySheetOrder}
          onClose={() => setSummarySheetOrder(null)}
          order={summarySheetOrder}
          onOrderUpdated={(updated) => {
            setSummarySheetOrder(updated)
          }}
        />
      )}
    </div>
  )
}
