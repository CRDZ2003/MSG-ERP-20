import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Navbar } from './components/common/Navbar'
import { Sidebar, NavTabId } from './components/common/Sidebar'
import { LoginPage } from './components/common/LoginPage'
import { Dashboard } from './components/dashboard/Dashboard'
import { MasterStock } from './components/inventory/MasterStock'
import { ItemMaster } from './components/inventory/ItemMaster'
import { HeatTraceabilityModal } from './components/inventory/HeatTraceabilityModal'
import { SalesOrderManagement } from './components/orders/SalesOrderManagement'
import { StockAllocationStudio } from './components/allocation/StockAllocationStudio'
import { StorekeeperApprovals } from './components/approvals/StorekeeperApprovals'
import { MTCManagement } from './components/mtc/MTCManagement'
import { LocalPurchaseManager } from './components/localPurchase/LocalPurchaseManager'
import { DispatchManager } from './components/dispatch/DispatchManager'
import { StockMovementsLedger } from './components/movements/StockMovementsLedger'
import { ReturnsAndAdjustments } from './components/returns/ReturnsAndAdjustments'
import { ReportsCenter } from './components/reports/ReportsCenter'
import { ExcelStudio } from './components/excel/ExcelStudio'
import { UserManagement } from './components/users/UserManagement'
import { AuditLogsView } from './components/audit/AuditLogsView'
import { SettingsView } from './components/settings/SettingsView'
import { PDFPreviewModal } from './components/common/PDFPreviewModal'
import { db } from './services/db'

const MainApp: React.FC = () => {
  const { isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard')
  const [, setDbVersion] = useState(0)

  // Reactive listener to DB changes across the app
  useEffect(() => {
    return db.subscribe(() => {
      setDbVersion(v => v + 1)
    })
  }, [])

  // Modals state
  const [activeHeatForModal, setActiveHeatForModal] = useState<string | null>(null)
  const [activePdfPreview, setActivePdfPreview] = useState<{
    docName: string
    itemCode: string
    heatNumber: string
  } | null>(null)

  // Preselected order for allocation studio
  const [preselectedAllocationOrderId, setPreselectedAllocationOrderId] = useState<string | undefined>()

  // Order status filter when navigating from dashboard
  const [orderInitialFilter, setOrderInitialFilter] = useState<string | undefined>()

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const handleGlobalSearchSelect = (type: 'heat' | 'order' | 'item' | 'lcode', id: string) => {
    if (type === 'heat') {
      setActiveHeatForModal(id)
    } else if (type === 'order') {
      setActiveTab('orders')
    } else if (type === 'item') {
      setActiveTab('items')
    } else if (type === 'lcode') {
      setActiveTab('local_purchase')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* Top Navbar */}
      <Navbar
        onSearchSelect={handleGlobalSearchSelect}
        onOpenSettings={() => setActiveTab('settings')}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard
                onNavigate={(tab, filter) => {
                  if (filter) setOrderInitialFilter(filter)
                  setActiveTab(tab)
                }}
                onSelectHeat={(heat) => setActiveHeatForModal(heat)}
              />
            )}

            {activeTab === 'stock' && (
              <MasterStock
                onSelectHeat={(heat) => setActiveHeatForModal(heat)}
                onOpenImport={() => setActiveTab('excel')}
                onPreviewMTC={(docName, itemCode, heat) =>
                  setActivePdfPreview({ docName, itemCode, heatNumber: heat })
                }
              />
            )}

            {activeTab === 'items' && <ItemMaster />}

            {activeTab === 'traceability' && (
              <MasterStock
                onSelectHeat={(heat) => setActiveHeatForModal(heat)}
                onOpenImport={() => setActiveTab('excel')}
                onPreviewMTC={(docName, itemCode, heat) =>
                  setActivePdfPreview({ docName, itemCode, heatNumber: heat })
                }
              />
            )}

            {activeTab === 'orders' && (
              <SalesOrderManagement
                initialStatusFilter={orderInitialFilter}
                onSelectOrder={(ord) => {
                  setPreselectedAllocationOrderId(ord.id)
                  setActiveTab('allocation')
                }}
                onNavigateToAllocation={(orderId) => {
                  setPreselectedAllocationOrderId(orderId)
                  setActiveTab('allocation')
                }}
              />
            )}

            {activeTab === 'allocation' && (
              <StockAllocationStudio
                preselectedOrderId={preselectedAllocationOrderId}
                onComplete={() => setActiveTab('orders')}
              />
            )}

            {activeTab === 'approvals' && <StorekeeperApprovals />}

            {activeTab === 'mtc' && (
              <MTCManagement
                onPreviewMTC={(docName, itemCode, heat) =>
                  setActivePdfPreview({ docName, itemCode, heatNumber: heat })
                }
              />
            )}

            {activeTab === 'local_purchase' && (
              <LocalPurchaseManager
                onPreviewMTC={(docName, itemCode, heat) =>
                  setActivePdfPreview({ docName, itemCode, heatNumber: heat })
                }
              />
            )}

            {activeTab === 'dispatch' && <DispatchManager />}

            {activeTab === 'movements' && <StockMovementsLedger />}

            {activeTab === 'returns' && <ReturnsAndAdjustments />}

            {activeTab === 'excel' && (
              <ExcelStudio
                onPreviewMTC={(docName, itemCode, heat) =>
                  setActivePdfPreview({ docName, itemCode, heatNumber: heat })
                }
              />
            )}

            {activeTab === 'users' && <UserManagement />}

            {activeTab === 'audit' && <AuditLogsView />}

            {activeTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global 360 Heat Traceability Modal */}
      {activeHeatForModal && (
        <HeatTraceabilityModal
          heatNumber={activeHeatForModal}
          onClose={() => setActiveHeatForModal(null)}
          onPreviewMTC={(docName, itemCode, heat) =>
            setActivePdfPreview({ docName, itemCode, heatNumber: heat })
          }
        />
      )}

      {/* Global In-App PDF Previewer Modal */}
      {activePdfPreview && (
        <PDFPreviewModal
          docName={activePdfPreview.docName}
          itemCode={activePdfPreview.itemCode}
          heatNumber={activePdfPreview.heatNumber}
          onClose={() => setActivePdfPreview(null)}
        />
      )}
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}

export default App
