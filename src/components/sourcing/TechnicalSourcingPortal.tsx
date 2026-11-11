import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  FileDown,
  Upload,
  Plus,
  Trash2,
  Copy,
  Split,
  Sparkles,
  Save,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Boxes,
  Truck,
  DollarSign,
  Globe,
  Archive,
} from 'lucide-react'
import {
  SourcingWorksheetData,
  SourcingLineItem,
  generateClientSummaryExcel,
  generateStoresSummaryExcel,
  generateCIPLLogisticExcel,
  generateSupplierPOZip,
  autoDetectMake,
  autoDetectCountryOfOrigin,
  autoDetectHSCode,
  estimateUnitWeight,
  isMeaningfulItem,
  saveSourcingDraft,
  getSourcingDrafts,
  deleteSourcingDraft,
} from '../../services/sourcingEngine'
import { parseCustomerSOPDF } from '../../services/pdfEngine'
import { db } from '../../services/db'

export const TechnicalSourcingPortal: React.FC = () => {
  const existingOrders = db.getOrders()

  // Worksheet State
  const [clientName, setClientName] = useState('Valoris Energy Services Company')
  const [poNumber, setPoNumber] = useState('10025 // 10044')
  const [msgRef, setMsgRef] = useState('MSG-0826-2117 / MSG-0926-2135')
  const [currency, setCurrency] = useState<'AED' | 'USD'>('AED')
  const [portOfLoading, setPortOfLoading] = useState('Jebel Ali / Dubai, UAE')
  const [portOfDischarge, setPortOfDischarge] = useState('Dammam Port, KSA')
  const [paymentTerms, setPaymentTerms] = useState('30 Days from B/L Date')
  const [filterMachinedOnly, setFilterMachinedOnly] = useState(false)

  // Items State
  const [items, setItems] = useState<SourcingLineItem[]>([
    {
      id: 'ITM-1',
      sl_no: 1,
      client_po_item_no: '1',
      description: 'CONC. RED. 2" X 1.1/2", SCH.80, BW, SMLS, ASTM A/ SA 234 WPB, ASME B16.9 (Machined from 2" Sch.160)',
      qty: 2,
      uom: 'PCS',
      heat_number: '68C20M091',
      certificate_number: 'MTC-68C20M091.pdf',
      make: 'BENKAN THAILAND',
      remarks: 'Machined from S.160 to Sch.80 locally',
      supplier_name: 'BENKAN THAILAND',
      supplier_po_number: 'PO-BENKAN-01',
      hs_code: '7307.93.00',
      country_of_origin: 'Thailand',
      unit_price: 35,
      total_price: 70,
      unit_weight_kg: 0.85,
      total_net_weight_kg: 1.7,
      total_gross_weight_kg: 2.0,
      package_no: 'PKG # 01',
      is_machined: true,
    },
    {
      id: 'ITM-2',
      sl_no: 2,
      client_po_item_no: '2',
      description: 'CONC. RED. 2" X 1", SCH.80, BW, SMLS, ASTM A/ SA 234 WPB, ASME B16.9 BENKAN THAILAND',
      qty: 3,
      uom: 'PCS',
      heat_number: '67C20M376',
      certificate_number: 'MTC-67C20M376.pdf',
      make: 'BENKAN THAILAND',
      remarks: 'Stock Available',
      supplier_name: 'BENKAN THAILAND',
      supplier_po_number: 'PO-BENKAN-01',
      hs_code: '7307.93.00',
      country_of_origin: 'Thailand',
      unit_price: 35,
      total_price: 105,
      unit_weight_kg: 0.75,
      total_net_weight_kg: 2.25,
      total_gross_weight_kg: 2.6,
      package_no: 'PKG # 01',
      is_machined: false,
    },
    {
      id: 'ITM-3',
      sl_no: 3,
      client_po_item_no: '3',
      description: 'RED. TEE 2" X 3/4", SCH.160, BW, SMLS, ASTM A/ SA 234 WPB, ASME B16.9',
      qty: 3,
      uom: 'PCS',
      heat_number: '68C10M073',
      certificate_number: 'MTC-68C10M073.pdf',
      make: 'BENKAN THAILAND',
      remarks: 'Standard Mill Fitting',
      supplier_name: 'BENKAN THAILAND',
      supplier_po_number: 'PO-BENKAN-01',
      hs_code: '7307.93.00',
      country_of_origin: 'Thailand',
      unit_price: 110,
      total_price: 330,
      unit_weight_kg: 1.2,
      total_net_weight_kg: 3.6,
      total_gross_weight_kg: 4.1,
      package_no: 'PKG # 02',
      is_machined: false,
    },
    {
      id: 'ITM-4',
      sl_no: 4,
      client_po_item_no: '4',
      description: 'WNRF FLANGE 4" 300# SCH 40 ASTM A105N ASME B16.5 (Modified Face to RTJ Locally)',
      qty: 4,
      uom: 'PCS',
      heat_number: 'H-99214',
      certificate_number: 'MTC-H-99214.pdf',
      make: 'Metalfar Italy',
      remarks: 'Modified RF to RTJ locally by machine shop',
      supplier_name: 'Local UAE Machine Shop',
      supplier_po_number: 'PO-LOCAL-FAB-02',
      hs_code: '7307.91.00',
      country_of_origin: 'Italy',
      unit_price: 185,
      total_price: 740,
      unit_weight_kg: 6.5,
      total_net_weight_kg: 26.0,
      total_gross_weight_kg: 29.5,
      package_no: 'PKG # 02',
      is_machined: true,
    },
  ])

  // UI State
  const [statusNotice, setStatusNotice] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false)
  const [draftsList, setDraftsList] = useState<SourcingWorksheetData[]>([])

  useEffect(() => {
    setDraftsList(getSourcingDrafts())
  }, [])

  // Auto-clear notice after 4 seconds
  useEffect(() => {
    if (statusNotice) {
      const timer = setTimeout(() => setStatusNotice(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [statusNotice])

  // Current Worksheet Object
  const currentWorksheetData: SourcingWorksheetData = {
    client: clientName,
    po_number: poNumber,
    msg_ref: msgRef,
    currency,
    port_of_loading: portOfLoading,
    port_of_discharge: portOfDischarge,
    payment_terms: paymentTerms,
    items,
    filter_machined_only: filterMachinedOnly,
  }

  // Handle PDF Upload & Auto-Populate
  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const parsed = await parseCustomerSOPDF(file)
      if (parsed.customerName) setClientName(parsed.customerName)
      if (parsed.poNumber) setPoNumber(parsed.poNumber)
      setMsgRef(`MSG-${new Date().toISOString().substring(2, 4)}${new Date().getMonth() + 1}-2026`)

      const newItems: SourcingLineItem[] = parsed.items.map((it, idx) => {
        const desc = it.itemDescription || `${it.itemCode} Oilfield Material`
        const detectedMake = autoDetectMake(desc) || autoDetectMake(it.itemCode) || 'BENKAN THAILAND'
        const detectedCOO = autoDetectCountryOfOrigin(detectedMake, desc, '')
        const detectedHS = autoDetectHSCode(desc)
        const unitWt = estimateUnitWeight(desc, 'PCS')
        const lineNet = Math.round(it.requiredQty * unitWt * 100) / 100
        const lineGross = Math.round(lineNet * 1.15 * 100) / 100
        const unitP = it.rate || 50
        const isMachined = isMeaningfulItem({ description: desc })

        const pos = it.position || idx + 1
        return {
          id: `ITM-PDF-${pos}-${Date.now()}`,
          sl_no: pos,
          client_po_item_no: it.clientPoItemNo || `${pos}`,
          description: desc,
          qty: it.requiredQty || 1,
          uom: 'PCS',
          heat_number: it.heatNumber || '',
          certificate_number: it.heatNumber ? `MTC-${it.heatNumber}.pdf` : '',
          make: detectedMake,
          remarks: isMachined ? 'Machined/Fabricated item' : (it.location ? `Loc: ${it.location}` : 'Stock Allocated'),
          supplier_name: it.purchaseType === 'local_purchase' ? 'Local UAE Supplier' : detectedMake,
          supplier_po_number: `PO-${idx + 1}`,
          hs_code: detectedHS,
          country_of_origin: detectedCOO,
          unit_price: unitP,
          total_price: (it.requiredQty || 1) * unitP,
          unit_weight_kg: unitWt,
          total_net_weight_kg: lineNet,
          total_gross_weight_kg: lineGross,
          package_no: `PKG # ${Math.floor(idx / 3) + 1}`,
          is_machined: isMachined,
        }
      })

      setItems(newItems)
      setStatusNotice(`Extracted ${newItems.length} line items from ${file.name} successfully!`)
    } catch (err: any) {
      alert('Error parsing PDF: ' + err.message)
    } finally {
      setIsUploading(false)
    }
  }

  // Load from existing Sales Order
  const handleLoadFromOrder = (orderId: string) => {
    const order = existingOrders.find(o => o.id === orderId)
    if (!order) return

    setClientName(order.customer_name)
    setPoNumber(order.po_number)
    setMsgRef(order.so_number)

    const newItems: SourcingLineItem[] = order.items.map((it, idx) => {
      const desc = it.item_description || `Item ${it.item_code}`
      const detectedMake = autoDetectMake(desc) || 'BENKAN THAILAND'
      const detectedCOO = autoDetectCountryOfOrigin(detectedMake, desc, '')
      const detectedHS = autoDetectHSCode(desc)
      const unitWt = estimateUnitWeight(desc, it.uom)
      const lineNet = Math.round(it.required_qty * unitWt * 100) / 100
      const lineGross = Math.round(lineNet * 1.15 * 100) / 100
      const isMachined = isMeaningfulItem({ description: desc })

      return {
        id: `ITM-ORD-${idx + 1}`,
        sl_no: idx + 1,
        client_po_item_no: `${idx + 1}`,
        description: desc,
        qty: it.required_qty,
        uom: it.uom || 'PCS',
        heat_number: it.heat_number || '',
        certificate_number: it.heat_number ? `MTC-${it.heat_number}.pdf` : '',
        make: detectedMake,
        remarks: it.location ? `Yard: ${it.location}` : 'Allocated',
        supplier_name: detectedMake,
        supplier_po_number: `PO-${idx + 1}`,
        hs_code: detectedHS,
        country_of_origin: detectedCOO,
        unit_price: 50,
        total_price: it.required_qty * 50,
        unit_weight_kg: unitWt,
        total_net_weight_kg: lineNet,
        total_gross_weight_kg: lineGross,
        package_no: `PKG # ${Math.floor(idx / 3) + 1}`,
        is_machined: isMachined,
      }
    })

    setItems(newItems)
    setStatusNotice(`Loaded ${newItems.length} line items from order ${order.so_number}!`)
  }

  // Update item field
  const handleUpdateItem = (id: string, field: keyof SourcingLineItem, value: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it
        const updated = { ...it, [field]: value }

        // Recalculate price & weights on quantity or price change
        if (field === 'qty' || field === 'unit_price') {
          updated.total_price = (updated.qty || 0) * (updated.unit_price || 0)
        }
        if (field === 'qty' || field === 'unit_weight_kg') {
          updated.total_net_weight_kg = Math.round((updated.qty || 0) * (updated.unit_weight_kg || 0) * 100) / 100
          updated.total_gross_weight_kg = Math.round(updated.total_net_weight_kg * 1.15 * 100) / 100
        }
        if (field === 'description' || field === 'remarks') {
          updated.is_machined = isMeaningfulItem({ description: updated.description, remarks: updated.remarks })
        }
        return updated
      })
    )
  }

  // Split item (Multi-heat / Partial Split)
  const handleSplitItem = (idx: number) => {
    const parent = items[idx]
    if (!parent) return

    const half1 = Math.ceil(parent.qty / 2)
    const half2 = Math.floor(parent.qty / 2) || 1

    const updatedParent: SourcingLineItem = {
      ...parent,
      qty: half1,
      total_price: half1 * parent.unit_price,
      total_net_weight_kg: Math.round(half1 * parent.unit_weight_kg * 100) / 100,
      total_gross_weight_kg: Math.round(half1 * parent.unit_weight_kg * 1.15 * 100) / 100,
      remarks: `${parent.remarks || ''} [Split Part 1]`.trim(),
    }

    const splitChild: SourcingLineItem = {
      ...parent,
      id: `ITM-SPLIT-${Date.now()}`,
      sl_no: parent.sl_no, // Keep same client item SL NO!
      client_po_item_no: `${parent.client_po_item_no}.1`,
      qty: half2,
      total_price: half2 * parent.unit_price,
      total_net_weight_kg: Math.round(half2 * parent.unit_weight_kg * 100) / 100,
      total_gross_weight_kg: Math.round(half2 * parent.unit_weight_kg * 1.15 * 100) / 100,
      heat_number: '',
      certificate_number: '',
      remarks: `${parent.remarks || ''} [Split Part 2 - Alternate Heat]`.trim(),
      parent_sl_no: parent.sl_no,
    }

    const updated = [...items]
    updated.splice(idx, 1, updatedParent, splitChild)
    setItems(updated)
    setStatusNotice(`Item #${parent.sl_no} split into 2 sub-rows for multi-heat allocation!`)
  }

  // Add blank item
  const handleAddItem = () => {
    const nextSl = items.length > 0 ? Math.max(...items.map(i => i.sl_no)) + 1 : 1
    const newItem: SourcingLineItem = {
      id: `ITM-NEW-${Date.now()}`,
      sl_no: nextSl,
      client_po_item_no: `${nextSl}`,
      description: 'FLANGE WNRF 2" 150# SCH 40 ASTM A105N ASME B16.5',
      qty: 1,
      uom: 'PCS',
      heat_number: '',
      certificate_number: '',
      make: 'Metalfar Italy',
      remarks: '',
      supplier_name: 'Metalfar Italy',
      supplier_po_number: `PO-${nextSl}`,
      hs_code: '7307.91.00',
      country_of_origin: 'Italy',
      unit_price: 65,
      total_price: 65,
      unit_weight_kg: 2.5,
      total_net_weight_kg: 2.5,
      total_gross_weight_kg: 2.9,
      package_no: `PKG # 01`,
      is_machined: false,
    }
    setItems([...items, newItem])
  }

  // Delete item
  const handleDeleteItem = (id: string) => {
    if (items.length <= 1) {
      alert('Cannot delete all items. At least 1 item is required.')
      return
    }
    setItems(items.filter(it => it.id !== id))
  }

  // Save draft
  const handleSaveDraft = () => {
    const saved = saveSourcingDraft(currentWorksheetData)
    setDraftsList(getSourcingDrafts())
    setStatusNotice(`Worksheet draft saved successfully (${saved.id})!`)
  }

  // Restore draft
  const handleRestoreDraft = (draft: SourcingWorksheetData) => {
    setClientName(draft.client)
    setPoNumber(draft.po_number)
    setMsgRef(draft.msg_ref)
    if (draft.currency) setCurrency(draft.currency as any)
    if (draft.port_of_loading) setPortOfLoading(draft.port_of_loading)
    if (draft.port_of_discharge) setPortOfDischarge(draft.port_of_discharge)
    if (draft.payment_terms) setPaymentTerms(draft.payment_terms)
    setItems(draft.items)
    setIsDraftsModalOpen(false)
    setStatusNotice(`Restored worksheet draft from ${new Date(draft.saved_at || '').toLocaleDateString()}!`)
  }

  // Auto-Detect All Missing
  const handleAutoDetectAll = () => {
    const updated = items.map(it => {
      const make = it.make || autoDetectMake(it.description) || 'BENKAN THAILAND'
      const coo = it.country_of_origin || autoDetectCountryOfOrigin(make, it.description, it.remarks)
      const hs = it.hs_code || autoDetectHSCode(it.description)
      const unitWt = it.unit_weight_kg || estimateUnitWeight(it.description, it.uom)
      const isMach = isMeaningfulItem({ description: it.description, remarks: it.remarks })

      return {
        ...it,
        make,
        country_of_origin: coo,
        hs_code: hs,
        unit_weight_kg: unitWt,
        total_net_weight_kg: Math.round(it.qty * unitWt * 100) / 100,
        total_gross_weight_kg: Math.round(it.qty * unitWt * 1.15 * 100) / 100,
        is_machined: isMach,
      }
    })
    setItems(updated)
    setStatusNotice('Auto-detected MAKE, Country of Origin, HS Codes, and Weights for all items!')
  }

  // Grand Totals
  const totalAmount = items.reduce((sum, i) => sum + i.total_price, 0)
  const totalNetWt = items.reduce((sum, i) => sum + i.total_net_weight_kg, 0)
  const totalGrossWt = items.reduce((sum, i) => sum + i.total_gross_weight_kg, 0)

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Integrated from konkanishow-gif/msg123
              </span>
              <span className="text-slate-400 text-xs font-mono">Dual Excel &amp; CIPL Engine</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Technical Sourcing, PO Split &amp; CIPL Portal
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl">
              Extract customer POs, manage item splits across multiple heat numbers, auto-detect machining &amp; HS codes,
              and export publication-quality Client Summary, Internal Stores Excel, CIPL Logistics, and Supplier PO packages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 transition-colors shadow-sm">
              <Upload className="h-4 w-4" />
              <span>{isUploading ? 'Extracting PDF...' : 'Upload SO PDF'}</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePDFUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>

            <button
              onClick={handleSaveDraft}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
              title="Save worksheet draft"
            >
              <Save className="h-4 w-4" />
              <span>Save Draft</span>
            </button>

            <button
              onClick={() => setIsDraftsModalOpen(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span>Drafts ({draftsList.length})</span>
            </button>
          </div>
        </div>

        {statusNotice && (
          <div className="mt-4 p-3 bg-emerald-900/60 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center space-x-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            <span>{statusNotice}</span>
          </div>
        )}
      </div>

      {/* Header Metadata Controls */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Client / Customer</label>
          <input
            type="text"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Customer PO Number</label>
          <input
            type="text"
            value={poNumber}
            onChange={e => setPoNumber(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">MSG Reference #</label>
          <input
            type="text"
            value={msgRef}
            onChange={e => setMsgRef(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-indigo-700 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Load Existing Order</label>
          <select
            onChange={e => {
              if (e.target.value) handleLoadFromOrder(e.target.value)
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 bg-slate-50 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            defaultValue=""
          >
            <option value="" disabled>Select Sales Order...</option>
            {existingOrders.map(o => (
              <option key={o.id} value={o.id}>
                {o.so_number} - {o.customer_name} ({o.items.length} items)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as any)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="AED">AED - United Arab Emirates Dirham</option>
            <option value="USD">USD - US Dollar ($)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Port of Loading</label>
          <input
            type="text"
            value={portOfLoading}
            onChange={e => setPortOfLoading(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Port of Discharge</label>
          <input
            type="text"
            value={portOfDischarge}
            onChange={e => setPortOfDischarge(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Payment Terms</label>
          <input
            type="text"
            value={paymentTerms}
            onChange={e => setPaymentTerms(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
          />
        </div>
      </div>

      {/* 4 Action Export Buttons Banner */}
      <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAutoDetectAll}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>Auto-Detect All (COO, HS, Wt)</span>
          </button>

          <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer ml-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={filterMachinedOnly}
              onChange={e => setFilterMachinedOnly(e.target.checked)}
              className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
            />
            <span>Filter Machined / Fab Items Only</span>
          </label>
        </div>

        {/* 4 Download Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Client Summary Excel */}
          <button
            onClick={() => generateClientSummaryExcel(currentWorksheetData, filterMachinedOnly)}
            className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors"
            title="Download 8-Column Client Summary Sheet (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Client Summary (.xlsx)</span>
          </button>

          {/* 2. Stores Internal Excel */}
          <button
            onClick={() => generateStoresSummaryExcel(currentWorksheetData, filterMachinedOnly)}
            className="bg-blue-700 hover:bg-blue-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors"
            title="Download 11-Column Stores Summary with Suppliers & Machining (.xlsx)"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Stores Summary (.xlsx)</span>
          </button>

          {/* 3. CIPL Generator */}
          <button
            onClick={() => generateCIPLLogisticExcel(currentWorksheetData)}
            className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors"
            title="Download Commercial Invoice & Packing List (.xlsx)"
          >
            <Truck className="h-4 w-4" />
            <span>CIPL Logistics (.xlsx)</span>
          </button>

          {/* 4. Supplier POs ZIP Package */}
          <button
            onClick={async () => {
              setIsExporting(true)
              try {
                await generateSupplierPOZip(currentWorksheetData)
                setStatusNotice('Supplier Purchase Orders package (.zip) generated and downloaded!')
              } catch (err: any) {
                alert('Error generating Supplier PO package: ' + err.message)
              } finally {
                setIsExporting(false)
              }
            }}
            disabled={isExporting}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center space-x-1.5 shadow-sm transition-colors"
            title="Generate & download official Supplier PO PDFs in ZIP bundle"
          >
            <Archive className="h-4 w-4" />
            <span>{isExporting ? 'Generating ZIP...' : 'Supplier POs (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Line Items Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center space-x-2">
            <h2 className="font-bold text-sm text-slate-800">
              Live Sourcing &amp; Allocation Worksheet
            </h2>
            <span className="text-xs bg-slate-200 text-slate-700 font-mono px-2 py-0.5 rounded-full">
              {items.length} lines
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-600">
              Total Value: <strong className="text-slate-900">{currency} {totalAmount.toLocaleString()}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">
              Net Wt: <strong className="text-slate-900">{Math.round(totalNetWt * 100) / 100} kg</strong>
            </span>
            <button
              onClick={handleAddItem}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-2.5 py-1.5 rounded-md flex items-center space-x-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-12 text-center">SL</th>
                <th className="p-2.5 w-20">PO Item</th>
                <th className="p-2.5 min-w-[260px]">Description &amp; Machining Spec</th>
                <th className="p-2.5 w-24 text-center">Qty / UOM</th>
                <th className="p-2.5 w-32">Heat Number</th>
                <th className="p-2.5 w-32">MTC Cert Ref</th>
                <th className="p-2.5 w-36">MAKE / Mfr</th>
                <th className="p-2.5 w-36">Supplier Name</th>
                <th className="p-2.5 w-28">HS Tariff</th>
                <th className="p-2.5 w-24">COO</th>
                <th className="p-2.5 w-24 text-right">Price ({currency})</th>
                <th className="p-2.5 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr
                  key={it.id}
                  className={`hover:bg-slate-50/70 transition-colors ${
                    it.is_machined ? 'bg-amber-50/40' : ''
                  }`}
                >
                  {/* SL NO */}
                  <td className="p-2.5 text-center font-bold text-slate-700">
                    {it.sl_no}
                  </td>

                  {/* Client PO Item No */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={it.client_po_item_no}
                      onChange={e => handleUpdateItem(it.id, 'client_po_item_no', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 text-center font-mono text-xs"
                    />
                  </td>

                  {/* Description */}
                  <td className="p-2.5">
                    <textarea
                      rows={2}
                      value={it.description}
                      onChange={e => handleUpdateItem(it.id, 'description', e.target.value)}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 leading-snug resize-y"
                    />
                    {it.is_machined && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        ⚙️ Machining Required
                      </span>
                    )}
                  </td>

                  {/* Qty & UOM */}
                  <td className="p-2.5 text-center">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        value={it.qty}
                        onChange={e => handleUpdateItem(it.id, 'qty', Number(e.target.value))}
                        className="w-14 border border-slate-200 rounded px-1 py-1 text-center font-bold text-xs"
                      />
                      <input
                        type="text"
                        value={it.uom}
                        onChange={e => handleUpdateItem(it.id, 'uom', e.target.value)}
                        className="w-10 border border-slate-200 rounded px-1 py-1 text-center text-[10px] uppercase font-mono"
                      />
                    </div>
                  </td>

                  {/* Heat Number */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      placeholder="e.g. 68C20M091"
                      value={it.heat_number}
                      onChange={e => handleUpdateItem(it.id, 'heat_number', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 font-mono text-[11px] font-bold text-red-700 bg-red-50/40"
                    />
                  </td>

                  {/* Certificate Number */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      placeholder="MTC-REF"
                      value={it.certificate_number}
                      onChange={e => handleUpdateItem(it.id, 'certificate_number', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 font-mono text-[11px] text-slate-600"
                    />
                  </td>

                  {/* MAKE */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={it.make}
                      onChange={e => handleUpdateItem(it.id, 'make', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs font-semibold text-slate-800"
                    />
                  </td>

                  {/* Supplier Name */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={it.supplier_name}
                      onChange={e => handleUpdateItem(it.id, 'supplier_name', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs text-blue-900 font-medium"
                    />
                  </td>

                  {/* HS Code */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={it.hs_code}
                      onChange={e => handleUpdateItem(it.id, 'hs_code', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 text-center font-mono text-[11px] text-slate-700"
                    />
                  </td>

                  {/* COO */}
                  <td className="p-2.5">
                    <input
                      type="text"
                      value={it.country_of_origin}
                      onChange={e => handleUpdateItem(it.id, 'country_of_origin', e.target.value)}
                      className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs text-slate-700"
                    />
                  </td>

                  {/* Price */}
                  <td className="p-2.5 text-right font-mono">
                    <input
                      type="number"
                      step="0.01"
                      value={it.unit_price}
                      onChange={e => handleUpdateItem(it.id, 'unit_price', Number(e.target.value))}
                      className="w-16 border border-slate-200 rounded px-1 py-1 text-right text-xs font-bold"
                    />
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      Tot: {it.total_price}
                    </span>
                  </td>

                  {/* Actions (Split, Delete) */}
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleSplitItem(idx)}
                        className="p-1 rounded text-orange-600 hover:bg-orange-50"
                        title="Split Item (Multi-Heat / Partial Quantity)"
                      >
                        <Split className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50"
                        title="Delete line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drafts Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Clock className="h-5 w-5 text-indigo-600" />
                <span>Saved Sourcing Drafts &amp; Worksheets</span>
              </h3>
              <button
                onClick={() => setIsDraftsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {draftsList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No saved drafts found. Click &quot;Save Draft&quot; on any worksheet to preserve your progress.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {draftsList.map(draft => (
                  <div
                    key={draft.id}
                    className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">
                        {draft.msg_ref} — {draft.client}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono">
                        PO: {draft.po_number} | {draft.items.length} items | Saved: {new Date(draft.saved_at || '').toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRestoreDraft(draft)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          if (draft.id) deleteSourcingDraft(draft.id)
                          setDraftsList(getSourcingDrafts())
                        }}
                        className="text-red-500 hover:text-red-700 p-1.5"
                        title="Delete draft"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
