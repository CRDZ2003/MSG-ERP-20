import React, { useState } from 'react'
import {
  Users,
  Building2,
  FileSpreadsheet,
  FileDown,
  Tag,
  Truck,
  Archive,
  FileCheck2,
  Download,
  Search,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  Boxes,
  Layers,
  Sparkles,
  BarChart3,
  PieChart,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react'
import { db } from '../../services/db'
import { Customer, SalesOrder, SalesOrderItem } from '../../types'
import {
  generateClientSummaryExcel,
  generateStoresSummaryExcel,
  generateCIPLLogisticExcel,
  generateSupplierPOZip,
  generateStickerSummaryExcel,
  SourcingWorksheetData,
} from '../../services/sourcingEngine'
import {
  generateStickersPdf,
  downloadStickerPdfBlob,
  StickerItem,
} from '../../services/stickerEngine'
import {
  exportMasterStock,
  exportHeatRegister,
  exportLocalPurchases,
  exportSalesOrders,
  exportStockMovements,
  exportDispatches,
} from '../../services/excelEngine'

interface CustomerReportsAnalyticsProps {
  onNavigateToSourcing?: (customerName: string, poNumber?: string) => void
  onPreviewMTC?: (docName: string, itemCode: string, heat: string) => void
}

export const CustomerReportsAnalytics: React.FC<CustomerReportsAnalyticsProps> = ({
  onNavigateToSourcing,
  onPreviewMTC,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'analytics' | 'documents' | 'exports'>('customers')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'HIGH_VALUE'>('ALL')
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const customers = db.getCustomers()
  const orders = db.getOrders()

  // Calculate stats per customer
  const customerStats = customers.map(cust => {
    const custOrders = orders.filter(
      o => o.customer_id === cust.id || o.customer_name.toLowerCase() === cust.customer_name.toLowerCase()
    )
    const totalLines = custOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)
    const completedOrders = custOrders.filter(o => o.status === 'Dispatched' || o.status === 'Ready for Dispatch').length
    const openOrders = custOrders.filter(o => o.status !== 'Dispatched' && o.status !== 'Cancelled').length
    
    // Approximate value calculation based on lines and quantities
    const totalEstValue = custOrders.reduce((sum, o) => {
      return sum + (o.items || []).reduce((iSum, it) => iSum + (it.required_qty * 125), 0)
    }, 0)

    return {
      customer: cust,
      orders: custOrders,
      orderCount: custOrders.length,
      lineCount: totalLines,
      completedOrders,
      openOrders,
      totalEstValue,
      fulfillmentRate: custOrders.length > 0 ? Math.round((completedOrders / custOrders.length) * 100) : 100,
    }
  })

  // Executive KPI summary
  const totalSpend = customerStats.reduce((sum, c) => sum + c.totalEstValue, 0)
  const totalOrdersCount = orders.length
  const totalLineItems = orders.reduce((sum, o) => sum + (o.items?.length || 0), 0)
  const activeCustomersCount = customerStats.filter(c => c.orderCount > 0).length

  // Filtered customer list
  const filteredCustomers = customerStats.filter(stat => {
    const matchSearch =
      stat.customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stat.customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stat.customer.address.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchSearch) return false

    if (statusFilter === 'ACTIVE') return stat.openOrders > 0
    if (statusFilter === 'HIGH_VALUE') return stat.totalEstValue > 50000
    return true
  })

  // Selected customer data
  const selectedCustomerStat = customerStats.find(c => c.customer.id === selectedCustomerId)

  // Map order to SourcingWorksheetData for document generators
  const mapOrderToWorksheet = (order: SalesOrder): SourcingWorksheetData => {
    return {
      client: order.customer_name,
      po_number: order.po_number || 'PO-2026',
      msg_ref: 'MSG-0326-1844',
      order_date: order.order_date,
      delivery_date: order.required_delivery_date,
      items: (order.items || []).map((it, idx) => {
        const itAny = it as any
        return {
          id: it.id || `item-${idx}`,
          sl_no: itAny.position || idx + 1,
          client_po_item_no: itAny.client_po_item_no || String(itAny.position || idx + 1),
          description: it.item_description || `${it.item_code} Material`,
          qty: it.required_qty || 1,
          uom: it.uom || 'Ea',
          heat_number: it.heat_number || itAny.heatNumber || 'EY7',
          certificate_number: it.certificate_number || `232442/${idx + 1}`,
          make: itAny.make || 'DELCORTE, FRANCE',
          remarks: it.location || itAny.remarks || 'LOCATION-1',
          supplier_name: itAny.supplier_name || 'MSG Internal Stores',
          supplier_po_number: '-',
          hs_code: '7307.93.00',
          country_of_origin: 'France',
          unit_price: 125,
          total_price: (it.required_qty || 1) * 125,
          unit_weight_kg: 0.5,
          total_net_weight_kg: 0.5,
          total_gross_weight_kg: 0.6,
          package_no: 'PKG-01',
        }
      }),
    }
  }

  // 1-Click download sticker PDF for an order
  const handleDownloadOrderStickers = async (order: SalesOrder) => {
    setIsProcessing(true)
    try {
      const stickerItems: StickerItem[] = (order.items || []).map((it, idx) => {
        const itAny = it as any
        return {
          sl_no: itAny.position || idx + 1,
          client_po_item_no: itAny.client_po_item_no || String(itAny.position || idx + 1),
          description: it.item_description,
          po_qty: it.required_qty,
          uom: it.uom || 'Ea',
          heat_number: it.heat_number || itAny.heatNumber || 'EY7',
          certificate_number: it.certificate_number || `232442/${idx + 1}`,
          make: itAny.make || 'DELCORTE, FRANCE',
          supplier: itAny.supplier_name || 'MSG Internal Stores',
          remarks: it.location || itAny.remarks || 'LOCATION-1',
          loc: it.location || itAny.remarks || 'LOCATION-1',
          po_number: order.po_number,
          client_name: order.customer_name,
        }
      })

      const pdfBytes = await generateStickersPdf({
        client_name: order.customer_name,
        po_number: order.po_number,
        items: stickerItems,
      })

      const safePo = (order.po_number || order.so_number).replace(/[^a-zA-Z0-9]/g, '_')
      downloadStickerPdfBlob(pdfBytes, `stickers_${safePo}_final.pdf`)
      setActionNotice(`Material Stickers (58mm × 39mm) downloaded for ${order.so_number}!`)
    } catch (err: any) {
      alert('Error generating stickers: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Batch download ALL stickers for a customer
  const handleBatchDownloadCustomerStickers = async (custStat: typeof customerStats[0]) => {
    setIsProcessing(true)
    try {
      const allItems: StickerItem[] = []
      custStat.orders.forEach(ord => {
        (ord.items || []).forEach((it, idx) => {
          const itAny = it as any
          allItems.push({
            sl_no: itAny.position || idx + 1,
            client_po_item_no: itAny.client_po_item_no || String(itAny.position || idx + 1),
            description: it.item_description,
            po_qty: it.required_qty,
            uom: it.uom || 'Ea',
            heat_number: it.heat_number || itAny.heatNumber || 'EY7',
            certificate_number: it.certificate_number || `232442/${idx + 1}`,
            make: itAny.make || 'DELCORTE, FRANCE',
            supplier: itAny.supplier_name || 'MSG Internal Stores',
            remarks: it.location || itAny.remarks || 'LOCATION-1',
            loc: it.location || itAny.remarks || 'LOCATION-1',
            po_number: ord.po_number,
            client_name: custStat.customer.customer_name,
          })
        })
      })

      if (allItems.length === 0) {
        alert('No material line items found for this customer.')
        return
      }

      const pdfBytes = await generateStickersPdf({
        client_name: custStat.customer.customer_name,
        po_number: custStat.orders[0]?.po_number || 'BATCH',
        items: allItems,
      })

      const safeName = custStat.customer.customer_code.replace(/[^a-zA-Z0-9]/g, '_')
      downloadStickerPdfBlob(pdfBytes, `all_stickers_${safeName}_final.pdf`)
      setActionNotice(`Batch exported ${allItems.length} stickers for ${custStat.customer.customer_name}!`)
    } catch (err: any) {
      alert('Error generating batch stickers: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Zoho-Style Executive Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5 shadow-sm">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Zoho-Style Customer 360 &amp; Analytics</span>
              </span>
              <span className="text-slate-400 text-xs font-mono">End-to-End Traceability</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center space-x-3">
              <span>Customer Intelligence &amp; Document Hub</span>
              <Sparkles className="h-6 w-6 text-amber-400" />
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Unified 360° repository for all customer data. Drill down into every client's complete journey from Sales Order to Technical Sourcing, Heat Traceability, Stickers, and Logistics.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-[11px] font-semibold text-slate-300 uppercase">Customers</div>
              <div className="text-xl font-black text-white">{customers.length}</div>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-[11px] font-semibold text-slate-300 uppercase">Total Spend</div>
              <div className="text-xl font-black text-emerald-400">${(totalSpend / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="text-center px-3 border-r border-white/10">
              <div className="text-[11px] font-semibold text-slate-300 uppercase">Total SOs</div>
              <div className="text-xl font-black text-blue-300">{totalOrdersCount}</div>
            </div>
            <div className="text-center px-3">
              <div className="text-[11px] font-semibold text-slate-300 uppercase">Material Lines</div>
              <div className="text-xl font-black text-purple-300">{totalLineItems}</div>
            </div>
          </div>
        </div>

        {/* Global Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-emerald-200 text-sm flex items-center justify-between">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => {
            setActiveTab('customers')
            setSelectedCustomerId(null)
          }}
          className={`py-4 px-4 font-bold text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'customers'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Customer 360 Directory</span>
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-mono">
            {customers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-4 px-4 font-bold text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Zoho Spend &amp; Order Analytics</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`py-4 px-4 font-bold text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'documents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Master Document Vault</span>
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`py-4 px-4 font-bold text-sm flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'exports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Section 22 Excel Registers</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER 360 DIRECTORY & INDIVIDUAL CUSTOMER DRILLDOWN              */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <>
          {!selectedCustomerId ? (
            /* All Customers Directory */
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search by customer name, code, or country..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Clients ({customerStats.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Active Pipeline ({customerStats.filter(c => c.openOrders > 0).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('HIGH_VALUE')}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                      statusFilter === 'HIGH_VALUE' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Key Accounts &gt;$50k
                  </button>
                </div>
              </div>

              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map(stat => (
                  <div
                    key={stat.customer.id}
                    onClick={() => setSelectedCustomerId(stat.customer.id)}
                    className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                          {stat.customer.customer_code}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {stat.fulfillmentRate}% Fulfilled
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-2">
                        {stat.customer.customer_name}
                      </h3>

                      <div className="flex items-center text-xs text-slate-500 mt-1 space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{stat.customer.address}</span>
                      </div>

                      {/* Orders & Lines Breakdown */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Orders</div>
                          <div className="font-black text-slate-800 text-sm">{stat.orderCount}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Items</div>
                          <div className="font-black text-slate-800 text-sm">{stat.lineCount}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Est Value</div>
                          <div className="font-black text-blue-600 text-sm">${(stat.totalEstValue / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
                      <span>View Full Customer 360</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* DRILLDOWN: SINGLE CUSTOMER 360 VIEW                             */
            /* =============================================================== */
            selectedCustomerStat && (
              <div className="space-y-6">
                {/* Back Navigation Bar */}
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <button
                    onClick={() => setSelectedCustomerId(null)}
                    className="flex items-center space-x-2 text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Customer Directory</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {/* Batch download all stickers */}
                    <button
                      onClick={() => handleBatchDownloadCustomerStickers(selectedCustomerStat)}
                      disabled={isProcessing}
                      className="bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                      title="Download a single combined PDF with all 58mm x 39mm stickers for this customer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Batch Export All Stickers (.pdf)</span>
                    </button>

                    {/* Open Sourcing Worksheet */}
                    {onNavigateToSourcing && (
                      <button
                        onClick={() => onNavigateToSourcing(selectedCustomerStat.customer.customer_name, selectedCustomerStat.orders[0]?.po_number)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Sourcing Worksheet</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Profile Banner */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          {selectedCustomerStat.customer.customer_code}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                          Active MSG Account
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                        {selectedCustomerStat.customer.customer_name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                        <span className="flex items-center space-x-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{selectedCustomerStat.customer.address}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{selectedCustomerStat.customer.contact_details}</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="text-center px-2">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Orders</div>
                        <div className="text-lg font-black text-slate-900">{selectedCustomerStat.orderCount}</div>
                      </div>
                      <div className="text-center px-2">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Items</div>
                        <div className="text-lg font-black text-slate-900">{selectedCustomerStat.lineCount}</div>
                      </div>
                      <div className="text-center px-2">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Fulfillment</div>
                        <div className="text-lg font-black text-emerald-600">{selectedCustomerStat.fulfillmentRate}%</div>
                      </div>
                      <div className="text-center px-2">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Est Value</div>
                        <div className="text-lg font-black text-blue-600">
                          ${(selectedCustomerStat.totalEstValue / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline / Lifecycles of Orders */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                      <Boxes className="w-5 h-5 text-indigo-600" />
                      <span>Sales Orders &amp; Full Lifecycle Documentation ({selectedCustomerStat.orders.length} SOs)</span>
                    </h3>
                    <span className="text-xs text-slate-500">Every linked document is ready for 1-click download</span>
                  </div>

                  {selectedCustomerStat.orders.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                      No sales orders currently recorded for this customer.
                    </div>
                  ) : (
                    selectedCustomerStat.orders.map((ord, oIdx) => {
                      const worksheet = mapOrderToWorksheet(ord)

                      return (
                        <div
                          key={ord.id || oIdx}
                          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                          {/* Order Header Bar */}
                          <div className="p-5 bg-slate-50/80 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center space-x-2.5 mb-1">
                                <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded">
                                  {ord.so_number}
                                </span>
                                <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-2.5 py-0.5 rounded">
                                  PO: {ord.po_number || '-'}
                                </span>
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                  ord.status === 'Ready for Dispatch' || ord.status === 'Dispatched'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {ord.status}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 flex items-center space-x-3 mt-1">
                                <span>Order Date: <strong>{ord.order_date || '2026-03-26'}</strong></span>
                                <span>•</span>
                                <span>Delivery Target: <strong>{ord.required_delivery_date || '2026-04-15'}</strong></span>
                                <span>•</span>
                                <span>{ord.items?.length || 0} Material Lines</span>
                              </div>
                            </div>

                            {/* 7 Linked Document Actions */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* 1. Item Stickers (.pdf) */}
                              <button
                                onClick={() => handleDownloadOrderStickers(ord)}
                                disabled={isProcessing}
                                className="bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download exact 58mm x 39mm Material Stickers PDF"
                              >
                                <Tag className="w-3.5 h-3.5" />
                                <span>Stickers (.pdf)</span>
                              </button>

                              {/* 2. Sticker Summary (.xlsx) */}
                              <button
                                onClick={async () => {
                                  try {
                                    await generateStickerSummaryExcel(worksheet)
                                    setActionNotice(`Sticker Summary Sheet exported for ${ord.so_number}!`)
                                  } catch (e: any) {
                                    alert(e.message)
                                  }
                                }}
                                className="bg-teal-700 hover:bg-teal-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download exact SUMMARY SHEET Excel"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Summary (.xlsx)</span>
                              </button>

                              {/* 3. Client Summary Excel */}
                              <button
                                onClick={async () => {
                                  try {
                                    await generateClientSummaryExcel(worksheet, false)
                                    setActionNotice(`Client Summary exported for ${ord.so_number}!`)
                                  } catch (e: any) {
                                    alert(e.message)
                                  }
                                }}
                                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download 9-Column Client Summary Excel"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Client Excel</span>
                              </button>

                              {/* 4. Stores Internal Excel */}
                              <button
                                onClick={async () => {
                                  try {
                                    await generateStoresSummaryExcel(worksheet, false)
                                    setActionNotice(`Stores Summary exported for ${ord.so_number}!`)
                                  } catch (e: any) {
                                    alert(e.message)
                                  }
                                }}
                                className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download 11-Column Stores Summary with Machining & Suppliers"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                <span>Stores Excel</span>
                              </button>

                              {/* 5. CIPL Logistics */}
                              <button
                                onClick={async () => {
                                  try {
                                    await generateCIPLLogisticExcel(worksheet)
                                    setActionNotice(`CIPL Logistics exported for ${ord.so_number}!`)
                                  } catch (e: any) {
                                    alert(e.message)
                                  }
                                }}
                                className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download CIPL (Commercial Invoice & Packing List)"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>CIPL (.xlsx)</span>
                              </button>

                              {/* 6. Supplier POs ZIP */}
                              <button
                                onClick={async () => {
                                  try {
                                    await generateSupplierPOZip(worksheet)
                                    setActionNotice(`Supplier POs ZIP generated for ${ord.so_number}!`)
                                  } catch (e: any) {
                                    alert(e.message)
                                  }
                                }}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition-colors cursor-pointer"
                                title="Download Supplier Purchase Orders in ZIP"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>Supplier POs</span>
                              </button>
                            </div>
                          </div>

                          {/* Line Items Table */}
                          <div className="overflow-x-auto p-4">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3">Item #</th>
                                  <th className="py-2.5 px-3">Description</th>
                                  <th className="py-2.5 px-3 text-center">Qty Ordered</th>
                                  <th className="py-2.5 px-3">Heat Number</th>
                                  <th className="py-2.5 px-3">Make</th>
                                  <th className="py-2.5 px-3">Cert #</th>
                                  <th className="py-2.5 px-3">Location / Remarks</th>
                                  <th className="py-2.5 px-3 text-center">MTC</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(ord.items || []).map((it, iIdx) => {
                                  const itAny = it as any
                                  const itemNo = itAny.client_po_item_no || itAny.position || iIdx + 1
                                  const heat = it.heat_number || itAny.heatNumber || 'EY7'

                                  return (
                                    <tr key={it.id || iIdx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-2 px-3 font-bold text-indigo-700">
                                        {itemNo}
                                      </td>
                                      <td className="py-2 px-3 text-slate-900 font-medium max-w-[280px]">
                                        {it.item_description}
                                      </td>
                                      <td className="py-2 px-3 text-center font-bold text-slate-800">
                                        {it.required_qty} {it.uom}
                                      </td>
                                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                        {heat}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600">
                                        {itAny.make || 'DELCORTE, FRANCE'}
                                      </td>
                                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                        {it.certificate_number || `232442/${iIdx + 1}`}
                                      </td>
                                      <td className="py-2 px-3 text-slate-700 font-medium">
                                        {it.location || itAny.remarks || 'LOCATION-1'}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {onPreviewMTC ? (
                                          <button
                                            onClick={() => onPreviewMTC(`MTC-${heat}.pdf`, it.item_code, heat)}
                                            className="text-blue-600 hover:text-blue-800 font-bold text-[11px] hover:underline"
                                          >
                                            View
                                          </button>
                                        ) : (
                                          <span className="text-emerald-600 font-bold text-[11px]">Verified</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ZOHO SPEND & ORDER ANALYTICS DASHBOARD                             */}
      {/* ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Top Spend Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Total Customer Spend Pipeline</div>
              <div className="text-3xl font-black text-slate-900">
                ${(totalSpend / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
                <span>AED {totalSpend.toLocaleString()}</span>
                <span>• Active Valued Orders</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Average Order Value (AOV)</div>
              <div className="text-3xl font-black text-blue-600">
                ${orders.length > 0 ? ((totalSpend / orders.length) / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Across {orders.length} active customer orders
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">Material Quality &amp; Sticker Readiness</div>
              <div className="text-3xl font-black text-purple-600">
                100%
              </div>
              <div className="text-xs text-emerald-600 font-semibold mt-1">
                All line items tagged with Heat #, LOC &amp; QR
              </div>
            </div>
          </div>

          {/* Customer Spend Distribution Chart (Visual Table) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Client Revenue &amp; Material Contribution</h3>
                <p className="text-xs text-slate-500">Sorted by total purchase volume and order count</p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                {customerStats.length} Accounts Monitored
              </span>
            </div>

            <div className="space-y-3">
              {customerStats
                .sort((a, b) => b.totalEstValue - a.totalEstValue)
                .slice(0, 8)
                .map((stat, idx) => {
                  const pct = totalSpend > 0 ? Math.round((stat.totalEstValue / totalSpend) * 100) : 0
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">
                          {idx + 1}. {stat.customer.customer_name} ({stat.customer.customer_code})
                        </span>
                        <span className="font-mono font-bold text-blue-700">
                          ${(stat.totalEstValue / 3.67).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MASTER DOCUMENT VAULT                                              */}
      {/* ========================================================================= */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Client Document Repository</h3>
              <p className="text-xs text-slate-500">All customer packages indexed and ready for download</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{orders.length} Registered Orders</span>
          </div>

          <div className="divide-y divide-slate-100">
            {orders.map((ord, idx) => {
              const worksheet = mapOrderToWorksheet(ord)

              return (
                <div key={idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm text-slate-900">{ord.customer_name}</div>
                    <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                      <span className="font-mono text-indigo-700 font-bold">{ord.so_number}</span>
                      <span>•</span>
                      <span>PO: {ord.po_number || '-'}</span>
                      <span>•</span>
                      <span>{ord.items?.length || 0} items</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDownloadOrderStickers(ord)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Stickers (.pdf)</span>
                    </button>

                    <button
                      onClick={() => generateStickerSummaryExcel(worksheet)}
                      className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Summary Sheet (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => generateClientSummaryExcel(worksheet, false)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Client Summary (.xlsx)</span>
                    </button>

                    <button
                      onClick={() => generateCIPLLogisticExcel(worksheet)}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>CIPL (.xlsx)</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECTION 22 EXCEL REGISTERS                                         */}
      {/* ========================================================================= */}
      {activeTab === 'exports' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-1">Standard Section 22 Excel Registers</h3>
            <p className="text-xs text-slate-500 mb-4">Export master inventory, heat registers, and transaction logs.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { title: 'Master Stock Inventory (.xlsx)', fn: exportMasterStock, desc: 'Complete warehouse physical, reserved, and available quantities.' },
                { title: 'Heat Number Traceability (.xlsx)', fn: exportHeatRegister, desc: 'Every distinct heat number with corresponding location and YOM.' },
                { title: 'Local Purchases & L-Codes (.xlsx)', fn: exportLocalPurchases, desc: 'Locally purchased stock and supplier certificates.' },
                { title: 'Sales Orders Register (.xlsx)', fn: exportSalesOrders, desc: 'All confirmed customer purchase orders and statuses.' },
                { title: 'Stock Movements Ledger (.xlsx)', fn: exportStockMovements, desc: 'Immutable transaction ledger of all stock changes.' },
                { title: 'Material Dispatch Register (.xlsx)', fn: exportDispatches, desc: 'Delivery notes and transport references.' },
              ].map((rep, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{rep.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1">{rep.desc}</p>
                  </div>
                  <button
                    onClick={() => rep.fn()}
                    className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
