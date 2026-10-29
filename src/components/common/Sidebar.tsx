import React from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  Package,
  Boxes,
  Flame,
  FileSpreadsheet,
  CheckSquare,
  FileCheck2,
  Truck,
  RotateCcw,
  BarChart3,
  FileUp,
  Users,
  ScrollText,
  Settings,
  ShoppingBag,
  History,
  Layers,
} from 'lucide-react'
import { db } from '../../services/db'

export type NavTabId =
  | 'dashboard'
  | 'stock'
  | 'items'
  | 'traceability'
  | 'orders'
  | 'allocation'
  | 'approvals'
  | 'mtc'
  | 'local_purchase'
  | 'dispatch'
  | 'movements'
  | 'returns'
  | 'reports'
  | 'excel'
  | 'users'
  | 'audit'
  | 'settings'

interface SidebarProps {
  activeTab: NavTabId
  onTabChange: (tab: NavTabId) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { canAccessModule } = useAuth()
  const orders = db.getOrders()
  const pendingApprovalsCount = orders.filter(o => o.status === 'Pending Storekeeper Approval').length
  const pendingMTCCount = orders.filter(o => o.status === 'Approved' && !o.mtc_package_generated).length

  const navItems: { id: NavTabId; label: string; icon: any; badge?: number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'stock', label: 'Master Stock', icon: Package },
    { id: 'items', label: 'Item Master', icon: Boxes },
    { id: 'traceability', label: 'Heat Traceability', icon: Flame },
    { id: 'orders', label: 'Sales Orders', icon: FileSpreadsheet },
    { id: 'allocation', label: 'Stock Allocation', icon: Layers },
    { id: 'approvals', label: 'Storekeeper Approvals', icon: CheckSquare, badge: pendingApprovalsCount, badgeColor: 'bg-amber-500' },
    { id: 'mtc', label: 'MTC Management', icon: FileCheck2, badge: pendingMTCCount, badgeColor: 'bg-blue-600' },
    { id: 'local_purchase', label: 'Local Purchases / L-Codes', icon: ShoppingBag },
    { id: 'dispatch', label: 'Dispatch Management', icon: Truck },
    { id: 'movements', label: 'Stock Movements (Ledger)', icon: History },
    { id: 'returns', label: 'Returns & Adjustments', icon: RotateCcw },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'excel', label: 'Excel Import / Export', icon: FileUp },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Supabase & Settings', icon: Settings },
  ]

  const accessibleItems = navItems.filter(item => canAccessModule(item.id))

  return (
    <aside className="w-64 bg-[#081C33] text-slate-300 flex flex-col border-r border-slate-700/80 shrink-0">
      <div className="p-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60 flex items-center justify-between">
        <span>ERP Modules</span>
        <span className="text-[10px] text-slate-400">MSG v2.0</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {accessibleItems.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-red-600 text-white font-bold shadow-md shadow-red-950/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/90'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`text-[10px] text-white px-1.5 py-0.5 rounded-full font-bold shrink-0 ${item.badgeColor || 'bg-red-600'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 bg-[#061526] border-t border-slate-800 text-[10px] text-slate-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Supabase Active</span>
          </span>
          <span className="text-slate-400">PostgreSQL</span>
        </div>
      </div>
    </aside>
  )
}
