import React, { useState } from 'react'
import { useAuth, VIP_PRESETS, DEFAULT_ROLE_MODULES } from '../../context/AuthContext'
import { db } from '../../services/db'
import { UserProfile, UserRole } from '../../types'
import {
  Crown,
  Check,
  RotateCcw,
  Eye,
  X,
  Users,
  Shield,
  LayoutDashboard,
  Package,
  Boxes,
  Flame,
  FileSpreadsheet,
  Layers,
  FileDown,
  Tag,
  Sparkles,
  CheckSquare,
  FileCheck2,
  ShoppingBag,
  Truck,
  History,
  BarChart3,
  FileUp,
  ScrollText,
  Settings,
  Sliders,
  CheckCircle2,
  Sparkle,
} from 'lucide-react'

export interface ModuleItemDef {
  id: string
  label: string
  category: 'Sales & Orders' | 'Stock & Heats' | 'Warehouse & Yard' | 'Quality & QA/QC' | 'System & Admin'
  icon: any
  description: string
  recommendedFor: string
}

export const ALL_ERP_MODULES: ModuleItemDef[] = [
  // Sales & Orders
  {
    id: 'orders',
    label: 'Sales Orders',
    category: 'Sales & Orders',
    icon: FileSpreadsheet,
    description: 'Process customer POs, PDF auto-parsing, and Excel Summary preview',
    recommendedFor: 'Sales Team, Executives',
  },
  {
    id: 'sourcing',
    label: 'Sourcing, Split & CIPL',
    category: 'Sales & Orders',
    icon: FileDown,
    description: 'Split orders by supplier, generate CIPL commercial invoice & packing list',
    recommendedFor: 'Sales, Sourcing, Logistics',
  },
  {
    id: 'stickers',
    label: 'Sticker Generator',
    category: 'Sales & Orders',
    icon: Sparkles,
    description: 'Generate 58mm × 39mm waterproof thermal barcode stickers with heats',
    recommendedFor: 'Sales, Warehouse, Packaging',
  },
  {
    id: 'loc',
    label: 'LOC & Material Tags',
    category: 'Sales & Orders',
    icon: Tag,
    description: 'Material identification tags, bin locations, and clean remarks tracking',
    recommendedFor: 'Storekeepers, QA/QC',
  },

  // Stock & Heats
  {
    id: 'stock',
    label: 'Master Stock',
    category: 'Stock & Heats',
    icon: Package,
    description: 'Live inventory stock, physical vs reserved counts, lot inspection',
    recommendedFor: 'Inventory, Sales, Warehouse',
  },
  {
    id: 'items',
    label: 'Item Master',
    category: 'Stock & Heats',
    icon: Boxes,
    description: 'Catalog of standard oilfield fittings, flanges, pipe specifications',
    recommendedFor: 'Inventory Managers',
  },
  {
    id: 'traceability',
    label: 'Heat Traceability',
    category: 'Stock & Heats',
    icon: Flame,
    description: '360° heat lot inspection, linked mill certs, full pedigree tracking',
    recommendedFor: 'QA/QC, Storekeepers, Auditors',
  },
  {
    id: 'allocation',
    label: 'Stock Allocation',
    category: 'Stock & Heats',
    icon: Layers,
    description: 'Studio to reserve and assign physical heat lots to sales order lines',
    recommendedFor: 'Inventory Managers, Sales',
  },

  // Warehouse & Yard
  {
    id: 'approvals',
    label: 'Storekeeper Approvals',
    category: 'Warehouse & Yard',
    icon: CheckSquare,
    description: 'Physical warehouse verification, heat number release, stamp confirmation',
    recommendedFor: 'Storekeepers, Yard Foremen',
  },
  {
    id: 'local_purchase',
    label: 'Local Purchases / L-Codes',
    category: 'Warehouse & Yard',
    icon: ShoppingBag,
    description: 'Emergency buyouts and local stock procurement with L-code tracking',
    recommendedFor: 'Procurement, Storekeepers',
  },
  {
    id: 'dispatch',
    label: 'Dispatch Management',
    category: 'Warehouse & Yard',
    icon: Truck,
    description: 'Outbound delivery notes, gate passes, vehicle manifest, shipping',
    recommendedFor: 'Logistics, Dispatchers',
  },
  {
    id: 'movements',
    label: 'Stock Movements (Ledger)',
    category: 'Warehouse & Yard',
    icon: History,
    description: 'Chronological double-entry audit ledger of all in/out material movements',
    recommendedFor: 'Inventory Controllers, Auditors',
  },
  {
    id: 'returns',
    label: 'Returns & Adjustments',
    category: 'Warehouse & Yard',
    icon: RotateCcw,
    description: 'Customer return goods, physical count adjustments, damaged lot quarantine',
    recommendedFor: 'Storekeepers, Inventory Admin',
  },

  // Quality & Compliance
  {
    id: 'mtc',
    label: 'MTC Management',
    category: 'Quality & QA/QC',
    icon: FileCheck2,
    description: 'EN 10204 3.1 mill test certificates, automated seals, chemical & mechanical compliance',
    recommendedFor: 'QA/QC Engineers, Document Controllers',
  },
  {
    id: 'reports',
    label: 'Reports & Analytics',
    category: 'Quality & QA/QC',
    icon: BarChart3,
    description: 'Customer ordering trends, stock aging, supplier performance intelligence',
    recommendedFor: 'Management, Executives',
  },

  // System & Administration
  {
    id: 'dashboard',
    label: 'KPI Dashboard',
    category: 'System & Admin',
    icon: LayoutDashboard,
    description: 'High-level metrics, pending approvals counter, rapid shortcuts',
    recommendedFor: 'All Users',
  },
  {
    id: 'excel',
    label: 'Excel Studio',
    category: 'System & Admin',
    icon: FileUp,
    description: 'Bulk stock spreadsheet import, formula validation, export sheets',
    recommendedFor: 'Admins, Data Operators',
  },
  {
    id: 'users',
    label: 'User Management',
    category: 'System & Admin',
    icon: Users,
    description: 'Create employee accounts, manage permissions and corporate roles',
    recommendedFor: 'Super Admin',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    category: 'System & Admin',
    icon: ScrollText,
    description: 'Immutable record of every user action, PDF generation, and data change',
    recommendedFor: 'Compliance, Super Admin',
  },
  {
    id: 'settings',
    label: 'Supabase & Settings',
    category: 'System & Admin',
    icon: Settings,
    description: 'Cloud PostgreSQL sync, API keys, database backups, system migrations',
    recommendedFor: 'Super Admin',
  },
]

interface VipAdminCustomizerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccessNotification?: (msg: string) => void
}

export const VipAdminCustomizerModal: React.FC<VipAdminCustomizerModalProps> = ({
  isOpen,
  onClose,
  onSuccessNotification,
}) => {
  const {
    currentUser,
    getAllowedModulesForTarget,
    updateCustomPermissions,
    resetCustomPermissions,
    switchDemoUser,
    switchDemoRole,
  } = useAuth()

  const allUsers = db.getUsers()

  const [activeTabMode, setActiveTabMode] = useState<'person' | 'role'>('person')
  const [selectedUserId, setSelectedUserId] = useState<string>(
    allUsers.find(u => u.role !== 'super_admin')?.id || allUsers[0]?.id || 'USR-003'
  )
  const [selectedRole, setSelectedRole] = useState<UserRole>('sales_team')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)
  const [bannerMsg, setBannerMsg] = useState<string | null>(null)

  // Determine active target key
  const activeTargetKey = activeTabMode === 'person' ? selectedUserId : selectedRole
  const activeUser = allUsers.find(u => u.id === selectedUserId)

  // Sync state when target changes
  React.useEffect(() => {
    const current = getAllowedModulesForTarget(activeTargetKey)
    setSelectedModules(current)
    setHasChanges(false)
  }, [activeTargetKey, activeTabMode])

  if (!isOpen) return null

  // Toggle single module
  const handleToggleModule = (modId: string) => {
    setSelectedModules(prev => {
      const exists = prev.includes(modId)
      const next = exists ? prev.filter(x => x !== modId) : [...prev, modId]
      setHasChanges(true)
      return next
    })
  }

  // Toggle all modules in a category
  const handleToggleCategory = (category: string, enableAll: boolean) => {
    const catModuleIds = ALL_ERP_MODULES.filter(m => m.category === category).map(m => m.id)
    setSelectedModules(prev => {
      let next: string[]
      if (enableAll) {
        next = Array.from(new Set([...prev, ...catModuleIds]))
      } else {
        next = prev.filter(id => !catModuleIds.includes(id))
      }
      setHasChanges(true)
      return next
    })
  }

  // Apply quick preset
  const handleApplyPreset = (presetId: string) => {
    const preset = VIP_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setSelectedModules([...preset.modules])
    setHasChanges(true)
    setBannerMsg(`Applied preset "${preset.label}". Click "Save & Apply" below to persist.`)
    setTimeout(() => setBannerMsg(null), 3500)
  }

  // Save changes
  const handleSave = () => {
    if (selectedModules.length === 0) {
      alert('Please keep at least 1 module selected so the team member can use the software.')
      return
    }

    updateCustomPermissions(activeTargetKey, selectedModules)
    setHasChanges(false)

    const targetLabel =
      activeTabMode === 'person'
        ? `${activeUser?.employee_name || selectedUserId} (${activeUser?.department})`
        : `Role: ${selectedRole.replace('_', ' ').toUpperCase()}`

    const msg = `VIP Customization Saved! ${targetLabel} now has access to only ${selectedModules.length} selected module(s).`
    setBannerMsg(msg)
    onSuccessNotification?.(msg)
    setTimeout(() => setBannerMsg(null), 4000)
  }

  // Reset to default
  const handleReset = () => {
    if (confirm(`Reset ${activeTargetKey} back to MSG ERP standard defaults?`)) {
      resetCustomPermissions(activeTargetKey)
      const def = getAllowedModulesForTarget(activeTargetKey)
      setSelectedModules(def)
      setHasChanges(false)
      setBannerMsg('Reset to standard defaults.')
      setTimeout(() => setBannerMsg(null), 3000)
    }
  }

  // Instant Test View As this Person / Role
  const handleTestView = () => {
    // If not saved, save first
    if (hasChanges) {
      updateCustomPermissions(activeTargetKey, selectedModules)
    }

    if (activeTabMode === 'person' && selectedUserId) {
      switchDemoUser(selectedUserId)
    } else {
      switchDemoRole(selectedRole)
    }

    onClose()
  }

  const categories = [
    'Sales & Orders',
    'Stock & Heats',
    'Warehouse & Yard',
    'Quality & QA/QC',
    'System & Admin',
  ] as const

  const simplifiedPercentage = Math.round(((20 - selectedModules.length) / 20) * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-amber-300/60 animate-in fade-in duration-200">
        
        {/* VIP Top Header */}
        <div className="bg-gradient-to-r from-[#07192F] via-[#0D2D56] to-[#07192F] text-white p-5 border-b border-amber-400/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#07192F] rounded-[10px] flex items-center justify-center">
                <Crown className="h-6 w-6 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900 font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                  VIP Admin Portal
                </span>
                <span className="text-white font-extrabold text-base tracking-wide uppercase">
                  Team Software Customizer
                </span>
              </div>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Customize exactly which options each person or role can see. Keep screens clean and simple for your team!
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {bannerMsg && (
          <div className="bg-emerald-500 text-white px-5 py-2.5 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-1 shrink-0">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
              <span>{bannerMsg}</span>
            </div>
            <button onClick={() => setBannerMsg(null)} className="text-white/80 hover:text-white">✕</button>
          </div>
        )}

        {/* Modal Body: Left Controls & Module Picker / Right Live Preview */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Main Configuration Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            
            {/* Target Mode Toggle & Selection Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center bg-white p-1 rounded-lg border border-slate-300 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('person')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      activeTabMode === 'person'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Customize by Team Member</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('role')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center space-x-1.5 ${
                      activeTabMode === 'role'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span>Customize by Role Default</span>
                  </button>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-semibold text-slate-500">Active Setup:</span>
                  <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    {selectedModules.length} of 20 Modules Visible
                  </span>
                  {simplifiedPercentage > 0 && (
                    <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                      {simplifiedPercentage}% Simplified
                    </span>
                  )}
                </div>
              </div>

              {/* Selector for Person or Role */}
              {activeTabMode === 'person' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Employee / Team Member to Customize:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {allUsers.map(u => {
                      const isSelected = selectedUserId === u.id
                      const userModuleCount = getAllowedModulesForTarget(u.id).length
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUserId(u.id)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center space-x-3 ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {u.employee_name.charAt(0)}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <div className="font-bold text-xs text-slate-800 truncate flex items-center justify-between">
                              <span className="truncate">{u.employee_name}</span>
                              <span className="text-[10px] font-mono font-normal text-slate-500 ml-1">
                                {userModuleCount} opt
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {u.department} • <span className="capitalize">{u.role.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Role / Department to Customize Default View:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { role: 'sales_team', label: 'Commercial Sales' },
                        { role: 'storekeeper', label: 'Storekeeper / Yard' },
                        { role: 'mtc_controller', label: 'QA / MTC Controller' },
                        { role: 'dispatch_team', label: 'Dispatch & Logistics' },
                        { role: 'admin_inventory', label: 'Inventory Manager' },
                        { role: 'management_viewer', label: 'Management Viewer' },
                        { role: 'super_admin', label: 'Super Admin' },
                      ] as { role: UserRole; label: string }[]
                    ).map(r => {
                      const isSelected = selectedRole === r.role
                      return (
                        <button
                          key={r.role}
                          type="button"
                          onClick={() => setSelectedRole(r.role)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 font-bold text-slate-900 shadow-xs'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                          }`}
                        >
                          <div className="text-xs font-bold truncate">{r.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            {getAllowedModulesForTarget(r.role).length} options visible
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick 1-Click Presets Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                  <Sparkle className="h-3.5 w-3.5 text-amber-500" />
                  <span>One-Click Easy Presets (Recommended):</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  Instantly set clean, tailored views
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {VIP_PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p.id)}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-amber-50/60 hover:border-amber-300 text-left transition-all group shadow-xs"
                    title={p.description}
                  >
                    <div className="font-bold text-[11px] text-slate-800 group-hover:text-amber-900 truncate">
                      {p.label}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                      {p.modules.length} modules
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Modules Checkbox Matrix by Category */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sliders className="h-4 w-4 text-slate-600" />
                  <span>Individual Module Controls ({selectedModules.length} Enabled)</span>
                </span>
                <div className="flex items-center space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModules(ALL_ERP_MODULES.map(m => m.id))
                      setHasChanges(true)
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModules(['dashboard', 'orders'])
                      setHasChanges(true)
                    }}
                    className="text-slate-600 hover:text-slate-800 font-semibold"
                  >
                    Keep Only 2 (Simple)
                  </button>
                </div>
              </div>

              {categories.map(cat => {
                const catModules = ALL_ERP_MODULES.filter(m => m.category === cat)
                const allSelected = catModules.every(m => selectedModules.includes(m.id))
                const someSelected = catModules.some(m => selectedModules.includes(m.id))

                return (
                  <div key={cat} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{cat}</span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(cat, !allSelected)}
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs"
                        >
                          {allSelected ? 'Uncheck All' : 'Check All'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catModules.map(mod => {
                        const Icon = mod.icon
                        const isChecked = selectedModules.includes(mod.id)

                        return (
                          <div
                            key={mod.id}
                            onClick={() => handleToggleModule(mod.id)}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start space-x-3 ${
                              isChecked
                                ? 'bg-amber-50/50 border-amber-300/80 shadow-2xs'
                                : 'bg-slate-50/40 border-slate-200/80 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent onClick
                              className="mt-0.5 h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-1.5">
                                <Icon className={`h-3.5 w-3.5 shrink-0 ${isChecked ? 'text-amber-700' : 'text-slate-400'}`} />
                                <span className={`text-xs font-bold truncate ${isChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                                  {mod.label}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                                {mod.description}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Live Sidebar Preview */}
          <div className="w-full md:w-72 bg-[#081C33] text-slate-300 p-4 border-t md:border-t-0 md:border-l border-slate-700 flex flex-col shrink-0">
            <div className="pb-3 border-b border-slate-700/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>Live Screen Preview</span>
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  What {activeTabMode === 'person' ? activeUser?.employee_name : selectedRole.replace('_', ' ')} will see:
                </p>
              </div>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] px-1.5 py-0.5 rounded font-bold">
                {selectedModules.length} items
              </span>
            </div>

            {/* Simulated Clean Sidebar */}
            <div className="flex-1 overflow-y-auto py-3 space-y-1">
              {ALL_ERP_MODULES.filter(m => selectedModules.includes(m.id)).map((m, idx) => {
                const Icon = m.icon
                return (
                  <div
                    key={m.id}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      idx === 0
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'text-slate-300 bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${idx === 0 ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{m.label}</span>
                  </div>
                )
              })}

              {selectedModules.length === 0 && (
                <div className="p-4 text-center text-xs text-rose-400">
                  No modules selected! Please pick at least 1 module.
                </div>
              )}
            </div>

            {/* Test View Button */}
            <div className="pt-3 border-t border-slate-700/80 space-y-2">
              <button
                type="button"
                onClick={handleTestView}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-semibold text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-colors"
                title="Switch active user to test their clean view immediately"
              >
                <Eye className="h-3.5 w-3.5 text-amber-400" />
                <span>Test View as {activeTabMode === 'person' ? activeUser?.employee_name.split(' ')[0] : 'Role'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-slate-600 hover:text-red-700 font-semibold text-xs px-3 py-2 rounded-lg flex items-center space-x-1 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Standard Defaults</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg shadow-md flex items-center space-x-1.5 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>Save & Apply Customization</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
