import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { UserRole } from '../../types'
import { Search, Shield, User, LogOut, ChevronDown, Bell, Database, Trash2 } from 'lucide-react'
import { db } from '../../services/db'
import { ClearDataModal } from './ClearDataModal'

interface NavbarProps {
  onSearchSelect: (type: 'heat' | 'order' | 'item' | 'lcode', id: string) => void
  onOpenSettings: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onSearchSelect, onOpenSettings }) => {
  const { currentUser, currentRole, switchDemoRole, logout } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)

  const masterStock = db.getMasterStockView()
  const orders = db.getOrders()

  // Real-time Global Search results
  const searchResults = searchTerm.trim().length > 1 ? {
    heats: masterStock.filter(s =>
      s.heat_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.l_code && s.l_code.toLowerCase().includes(searchTerm.toLowerCase()))
    ).slice(0, 5),
    items: masterStock.filter(s =>
      s.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.item_description.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5),
    orders: orders.filter(o =>
      o.so_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.po_number.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5),
  } : null

  const rolesList: { role: UserRole; label: string; department: string }[] = [
    { role: 'super_admin', label: 'Super Admin', department: 'Executive Management' },
    { role: 'admin_inventory', label: 'Inventory Manager', department: 'Inventory & Procurement' },
    { role: 'sales_team', label: 'Sales Team', department: 'Commercial Sales' },
    { role: 'storekeeper', label: 'Storekeeper', department: 'Warehouse & Yard-1' },
    { role: 'mtc_controller', label: 'MTC Controller', department: 'QA/QC' },
    { role: 'dispatch_team', label: 'Dispatch Team', department: 'Logistics' },
    { role: 'management_viewer', label: 'Management Viewer', department: 'Board of Directors' },
  ]

  const pendingApprovalsCount = orders.filter(o => o.status === 'Pending Storekeeper Approval').length

  return (
    <header className="bg-[#0B2545] text-white border-b border-slate-700 shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
        {/* Logo and Company Name */}
        <div className="flex items-center space-x-3">
          <div className="bg-white p-1 rounded-md shadow-sm border border-slate-300 flex items-center justify-center">
            <img src="/logo.png" alt="MSG Oilfield Logo" className="h-8 w-auto object-contain" onError={(e) => {
              (e.target as HTMLElement).style.display = 'none'
            }} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-extrabold tracking-wide uppercase text-white">MSG Oilfield</span>
              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">ERP Enterprise</span>
            </div>
            <p className="text-[11px] text-slate-300 hidden md:block">Stock Management, Heat Traceability & MTC System</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-md hidden sm:block">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Item Code, Heat#, L-Code, SO#, Customer, YOM..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setIsSearchOpen(true)
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-slate-800/90 border border-slate-600 text-xs rounded-lg pl-9 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Search Dropdown Results */}
          {isSearchOpen && searchResults && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 overflow-hidden z-50 text-xs max-h-96 overflow-y-auto">
              <div className="p-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-slate-500 font-medium">
                <span>Quick Search Results for "{searchTerm}"</span>
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕ Close</button>
              </div>

              {/* Heats Section */}
              {searchResults.heats.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">Heat Numbers / Lots</div>
                  {searchResults.heats.map(h => (
                    <div
                      key={h.id}
                      onClick={() => {
                        onSearchSelect('heat', h.heat_number)
                        setIsSearchOpen(false)
                      }}
                      className="p-2 rounded hover:bg-red-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-bold text-red-700">🔥 Heat: {h.heat_number}</span>
                        {h.l_code && <span className="ml-2 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold">L-Code: {h.l_code}</span>}
                        <p className="text-[11px] text-slate-600">{h.item_code} | YOM: {h.yom || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-700">{h.available_qty} PCS Avail</span>
                        <p className="text-[10px] text-slate-400">{h.warehouse_location}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Orders Section */}
              {searchResults.orders.length > 0 && (
                <div className="p-2 border-b border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">Sales Orders</div>
                  {searchResults.orders.map(o => (
                    <div
                      key={o.id}
                      onClick={() => {
                        onSearchSelect('order', o.so_number)
                        setIsSearchOpen(false)
                      }}
                      className="p-2 rounded hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-bold text-blue-900">{o.so_number}</span>
                        <span className="ml-2 text-slate-500 font-medium">({o.customer_name})</span>
                        <p className="text-[11px] text-slate-500">PO: {o.po_number} | Date: {o.order_date}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        o.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                        o.status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                        o.status === 'Approved' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Items Section */}
              {searchResults.items.length > 0 && (
                <div className="p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">Item Codes</div>
                  {searchResults.items.map(it => (
                    <div
                      key={it.id}
                      onClick={() => {
                        onSearchSelect('item', it.item_code)
                        setIsSearchOpen(false)
                      }}
                      className="p-2 rounded hover:bg-slate-100 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-900 font-mono">{it.item_code}</span>
                        <p className="text-[11px] text-slate-500">{it.item_description}</p>
                      </div>
                      <span className="text-slate-400 text-[10px]">{it.size}</span>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.heats.length === 0 && searchResults.orders.length === 0 && searchResults.items.length === 0 && (
                <div className="p-4 text-center text-slate-400">No records found matching "{searchTerm}"</div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Pending Alert, Demo Role Switcher, Supabase Status, User Profile */}
        <div className="flex items-center space-x-3">
          {/* Pending Storekeeper Approvals Notification */}
          {pendingApprovalsCount > 0 && (
            <div className="hidden lg:flex items-center space-x-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-2.5 py-1 rounded-full">
              <Bell className="h-3.5 w-3.5 animate-bounce text-amber-400" />
              <span className="font-bold">{pendingApprovalsCount}</span>
              <span className="text-[11px]">Approval Pending</span>
            </div>
          )}

          {/* Clear / Reset Data Button for Test Mode */}
          <button
            onClick={() => setIsClearModalOpen(true)}
            title="Clear All Data (Test Mode) or Reset Demo"
            className="flex items-center space-x-1 bg-rose-900/60 hover:bg-rose-800 border border-rose-700/80 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-200 hover:text-white transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-300" />
            <span className="hidden md:inline">Clear Data</span>
          </button>

          {/* Database Sync / Supabase Settings Icon */}
          <button
            onClick={onOpenSettings}
            title="Supabase PostgreSQL Settings & Migrations"
            className="flex items-center space-x-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Supabase DB</span>
          </button>

          {/* Role Switcher Pill / Dropdown for Fast Evaluation */}
          <div className="relative">
            <button
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              <Shield className="h-3.5 w-3.5 text-red-400" />
              <span className="font-semibold text-slate-200">
                {rolesList.find(r => r.role === currentRole)?.label || currentRole}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 py-1.5 z-50 text-xs">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Switch Active Role (RBAC Demo)
                </div>
                {rolesList.map(r => (
                  <button
                    key={r.role}
                    onClick={() => {
                      switchDemoRole(r.role)
                      setIsRoleDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      currentRole === r.role ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{r.label}</div>
                      <div className="text-[10px] text-slate-400">{r.department}</div>
                    </div>
                    {currentRole === r.role && <span className="text-red-600 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current User & Logout */}
          <div className="flex items-center space-x-2 border-l border-slate-700 pl-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-white leading-tight">{currentUser?.employee_name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400">{currentUser?.email}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-700 text-slate-300 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ClearDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
      />
    </header>
  )
}
