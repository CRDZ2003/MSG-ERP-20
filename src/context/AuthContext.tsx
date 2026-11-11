// Authentication Context & Role-Based Access Control for MSG Oilfield ERP
import React, { createContext, useContext, useState, useEffect } from 'react'
import { UserProfile, UserRole } from '../types'
import { initialUsers, db } from '../services/db'

export const DEFAULT_ROLE_MODULES: Record<UserRole, string[]> = {
  super_admin: [
    'dashboard', 'stock', 'items', 'traceability', 'orders', 'allocation', 'sourcing',
    'loc', 'stickers', 'approvals', 'mtc', 'local_purchase', 'dispatch', 'movements',
    'returns', 'reports', 'excel', 'users', 'audit', 'settings'
  ],
  admin_inventory: [
    'dashboard', 'stock', 'items', 'traceability', 'orders', 'allocation', 'sourcing',
    'loc', 'stickers', 'approvals', 'mtc', 'local_purchase', 'movements', 'returns', 'reports', 'excel', 'settings'
  ],
  sales_team: [
    'dashboard', 'orders', 'sourcing', 'stickers', 'loc', 'stock', 'traceability'
  ],
  storekeeper: [
    'approvals', 'stock', 'traceability', 'loc', 'dispatch', 'movements'
  ],
  mtc_controller: [
    'mtc', 'traceability', 'orders', 'stock', 'local_purchase'
  ],
  dispatch_team: [
    'dispatch', 'orders', 'stickers', 'stock'
  ],
  management_viewer: [
    'dashboard', 'reports', 'stock', 'orders', 'audit'
  ],
}

export interface VipPreset {
  id: string
  label: string
  description: string
  badge: string
  badgeColor: string
  modules: string[]
}

export const VIP_PRESETS: VipPreset[] = [
  {
    id: 'simplified_sales',
    label: 'Simplified Sales Team (4 Options)',
    description: 'Clean & focused for Sales: Sales Orders, Sourcing & CIPL, Stickers, and Dashboard.',
    badge: 'Popular for Sales',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    modules: ['dashboard', 'orders', 'sourcing', 'stickers'],
  },
  {
    id: 'storekeeper_yard',
    label: 'Storekeeper Yard View (4 Options)',
    description: 'Focused physical operations: Approvals, Master Stock, LOC & Tags, and Heat Traceability.',
    badge: 'Warehouse Yard',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    modules: ['approvals', 'stock', 'traceability', 'loc'],
  },
  {
    id: 'mtc_qa_fast',
    label: 'QA / QC & MTC Controller (3 Options)',
    description: 'Focused compliance: MTC Management, Heat Traceability, and Sales Orders.',
    badge: 'Inspection & MTC',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    modules: ['mtc', 'traceability', 'orders'],
  },
  {
    id: 'logistics_dispatch',
    label: 'Logistics & Dispatch (3 Options)',
    description: 'Physical dispatch & stickers: Dispatch Management, Sales Orders, and Stickers.',
    badge: 'Logistics',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    modules: ['dispatch', 'orders', 'stickers'],
  },
  {
    id: 'ultra_minimal',
    label: 'Ultra Minimalist (2 Options)',
    description: 'Easiest possible screen for beginner team members: Only Dashboard + Sales Orders.',
    badge: 'Ultra Simple',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    modules: ['dashboard', 'orders'],
  },
  {
    id: 'full_power',
    label: 'Full VIP Access (All 20 Options)',
    description: 'Complete unconstrained access to every single module, ledger, Excel studio, and settings.',
    badge: 'VIP Full Access',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    modules: [
      'dashboard', 'stock', 'items', 'traceability', 'orders', 'allocation', 'sourcing',
      'loc', 'stickers', 'approvals', 'mtc', 'local_purchase', 'dispatch', 'movements',
      'returns', 'reports', 'excel', 'users', 'audit', 'settings'
    ],
  },
]

interface AuthContextType {
  currentUser: UserProfile | null
  currentRole: UserRole
  isAuthenticated: boolean
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>
  logout: () => void
  switchDemoRole: (role: UserRole) => void
  switchDemoUser: (userId: string) => void
  resetToAdmin: () => void
  isSimulatingRoleOrUser: boolean
  hasPermission: (requiredRoles: UserRole[]) => boolean
  canAccessModule: (moduleName: string) => boolean
  customPermissions: Record<string, string[]>
  updateCustomPermissions: (targetKey: string, allowedModules: string[]) => void
  resetCustomPermissions: (targetKey?: string) => void
  getAllowedModulesForTarget: (targetKey: string) => string[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MODULE_PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  stock: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  items: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'management_viewer'],
  traceability: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  orders: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'dispatch_team', 'management_viewer'],
  allocation: ['super_admin', 'admin_inventory', 'sales_team'],
  sourcing: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'management_viewer'],
  loc: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'management_viewer'],
  stickers: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'management_viewer'],
  approvals: ['super_admin', 'storekeeper'],
  mtc: ['super_admin', 'admin_inventory', 'mtc_controller', 'sales_team', 'management_viewer'],
  local_purchase: ['super_admin', 'admin_inventory', 'mtc_controller', 'storekeeper', 'management_viewer'],
  dispatch: ['super_admin', 'dispatch_team', 'storekeeper', 'management_viewer'],
  movements: ['super_admin', 'admin_inventory', 'storekeeper', 'management_viewer'],
  returns: ['super_admin', 'admin_inventory', 'storekeeper'],
  reports: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  excel: ['super_admin', 'admin_inventory'],
  users: ['super_admin'],
  audit: ['super_admin', 'management_viewer'],
  settings: ['super_admin', 'admin_inventory'],
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('msg_current_user')
    return saved ? JSON.parse(saved) : initialUsers[0] // Default to Super Admin for smooth initial load
  })

  // Stored custom permissions map: { [userIdOrRole]: string[] }
  const [customPermissions, setCustomPermissions] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('msg_custom_module_permissions')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return {}
      }
    }
    return {}
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('msg_current_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('msg_current_user')
    }
  }, [currentUser])

  const login = async (email: string, _password?: string) => {
    const allUsers = db.getUsers()
    const user = allUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user) {
      return { success: false, message: 'Invalid credentials. User account not found.' }
    }
    if (user.account_status !== 'Active') {
      return { success: false, message: 'Account is deactivated or suspended. Please contact administrator.' }
    }

    user.last_login = new Date().toISOString().replace('T', ' ').substring(0, 16)
    setCurrentUser(user)
    return { success: true }
  }

  const logout = () => {
    setCurrentUser(null)
  }

  const switchDemoRole = (role: UserRole) => {
    const allUsers = db.getUsers()
    const user = allUsers.find(u => u.role === role) || initialUsers.find(u => u.role === role) || initialUsers[0]
    setCurrentUser(user)
  }

  const switchDemoUser = (userId: string) => {
    const allUsers = db.getUsers()
    const user = allUsers.find(u => u.id === userId)
    if (user) {
      setCurrentUser(user)
    }
  }

  const resetToAdmin = () => {
    const allUsers = db.getUsers()
    const admin = allUsers.find(u => u.role === 'super_admin') || initialUsers[0]
    setCurrentUser(admin)
  }

  const isSimulatingRoleOrUser = currentUser?.role !== 'super_admin'

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!currentUser) return false
    return requiredRoles.includes(currentUser.role)
  }

  const getAllowedModulesForTarget = (targetKey: string): string[] => {
    // 1. Direct custom permissions override
    if (customPermissions[targetKey]) {
      return customPermissions[targetKey]
    }

    // 2. If targetKey is a user id, check if their role has custom permissions
    const allUsers = db.getUsers()
    const user = allUsers.find(u => u.id === targetKey)
    if (user && customPermissions[user.role]) {
      return customPermissions[user.role]
    }

    // 3. Check role default modules
    if (user && DEFAULT_ROLE_MODULES[user.role]) {
      return DEFAULT_ROLE_MODULES[user.role]
    }

    // 4. Target is role directly
    if (DEFAULT_ROLE_MODULES[targetKey as UserRole]) {
      return DEFAULT_ROLE_MODULES[targetKey as UserRole]
    }

    return DEFAULT_ROLE_MODULES.sales_team
  }

  const canAccessModule = (moduleName: string): boolean => {
    if (!currentUser) return false

    // Super Admin retains administrative access so they can never lock themselves out
    if (currentUser.role === 'super_admin' && (moduleName === 'users' || moduleName === 'settings' || moduleName === 'audit')) {
      return true
    }

    // Check specific user custom configuration first
    if (customPermissions[currentUser.id]) {
      return customPermissions[currentUser.id].includes(moduleName)
    }

    // Check role custom configuration
    if (customPermissions[currentUser.role]) {
      return customPermissions[currentUser.role].includes(moduleName)
    }

    // Fall back to default role module map
    const defaultModules = DEFAULT_ROLE_MODULES[currentUser.role]
    if (defaultModules) {
      return defaultModules.includes(moduleName)
    }

    const allowed = MODULE_PERMISSIONS[moduleName]
    return allowed ? allowed.includes(currentUser.role) : true
  }

  const updateCustomPermissions = (targetKey: string, allowedModules: string[]) => {
    setCustomPermissions(prev => {
      const next = { ...prev, [targetKey]: allowedModules }
      localStorage.setItem('msg_custom_module_permissions', JSON.stringify(next))
      return next
    })
  }

  const resetCustomPermissions = (targetKey?: string) => {
    setCustomPermissions(prev => {
      const next = { ...prev }
      if (targetKey) {
        delete next[targetKey]
      } else {
        return {}
      }
      localStorage.setItem('msg_custom_module_permissions', JSON.stringify(next))
      return next
    })
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole: currentUser?.role || 'management_viewer',
        isAuthenticated: !!currentUser,
        login,
        logout,
        switchDemoRole,
        switchDemoUser,
        resetToAdmin,
        isSimulatingRoleOrUser,
        hasPermission,
        canAccessModule,
        customPermissions,
        updateCustomPermissions,
        resetCustomPermissions,
        getAllowedModulesForTarget,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
