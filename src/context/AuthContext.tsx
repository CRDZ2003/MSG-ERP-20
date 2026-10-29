// Authentication Context & Role-Based Access Control for MSG Oilfield ERP
import React, { createContext, useContext, useState, useEffect } from 'react'
import { UserProfile, UserRole } from '../types'
import { initialUsers } from '../services/db'

interface AuthContextType {
  currentUser: UserProfile | null
  currentRole: UserRole
  isAuthenticated: boolean
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>
  logout: () => void
  switchDemoRole: (role: UserRole) => void
  hasPermission: (requiredRoles: UserRole[]) => boolean
  canAccessModule: (moduleName: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const MODULE_PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  stock: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  items: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'management_viewer'],
  traceability: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'mtc_controller', 'dispatch_team', 'management_viewer'],
  orders: ['super_admin', 'admin_inventory', 'sales_team', 'storekeeper', 'dispatch_team', 'management_viewer'],
  allocation: ['super_admin', 'admin_inventory', 'sales_team'],
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

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('msg_current_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('msg_current_user')
    }
  }, [currentUser])

  const login = async (email: string, _password?: string) => {
    const user = initialUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
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
    const user = initialUsers.find(u => u.role === role) || initialUsers[0]
    setCurrentUser(user)
  }

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (!currentUser) return false
    return requiredRoles.includes(currentUser.role)
  }

  const canAccessModule = (moduleName: string): boolean => {
    if (!currentUser) return false
    const allowed = MODULE_PERMISSIONS[moduleName]
    return allowed ? allowed.includes(currentUser.role) : true
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
        hasPermission,
        canAccessModule,
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
