import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { UserProfile, UserRole } from '../../types'
import { Users, UserPlus, Shield, CheckCircle2, XCircle, KeyRound, Edit } from 'lucide-react'

export const UserManagement: React.FC = () => {
  const { hasPermission } = useAuth()
  const users = db.getUsers()

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('Commercial Sales')
  const [role, setRole] = useState<UserRole>('sales_team')

  const canManage = hasPermission(['super_admin'])

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) {
      alert('Please fill employee name and email.')
      return
    }

    const newUser: UserProfile = {
      id: 'USR-' + (users.length + 1).toString().padStart(3, '0'),
      employee_name: name,
      email: email.trim().toLowerCase(),
      department,
      role,
      account_status: 'Active',
      created_at: new Date().toISOString().substring(0, 10),
    }

    users.push(newUser)
    localStorage.setItem('msg_oilfield_v1_users', JSON.stringify(users))
    alert(`Account for ${name} (${role}) created successfully! An invite link has been dispatched.`)
    setIsAddUserModalOpen(false)
    setName('')
    setEmail('')
  }

  const handleToggleStatus = (u: UserProfile) => {
    u.account_status = u.account_status === 'Active' ? 'Inactive' : 'Active'
    localStorage.setItem('msg_oilfield_v1_users', JSON.stringify(users))
    alert(`Account status for ${u.employee_name} updated to ${u.account_status}.`)
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Enterprise User & Role Administration</h1>
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 3.3 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage employee access, assigned corporate roles, active sessions, and password security.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create New User Account</span>
          </button>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 bg-slate-100 font-bold text-xs uppercase text-slate-700 border-b border-slate-200">
          Authorized Employees & Assigned Permissions
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
              <tr>
                <th className="p-3">Employee Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Login</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{u.employee_name}</td>
                  <td className="p-3 font-mono text-slate-600">{u.email}</td>
                  <td className="p-3">
                    <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px] capitalize">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{u.department}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.account_status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.account_status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{u.last_login || 'Never'}</td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {canManage && (
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="text-[11px] text-slate-600 hover:text-red-700 font-semibold"
                        >
                          {u.account_status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => alert(`Password reset link sent to ${u.email}`)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Reset Pass
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase">Create Employee Account</h3>
              <button onClick={() => setIsAddUserModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Employee Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Al-Hashimi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Corporate Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="name@msgoilfield.ae"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role & Permissions *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="super_admin">ROLE 1: Super Admin (Full Privileges)</option>
                  <option value="admin_inventory">ROLE 2: Admin / Inventory Manager</option>
                  <option value="sales_team">ROLE 3: Sales Team</option>
                  <option value="storekeeper">ROLE 4: Storekeeper (Physical Verification)</option>
                  <option value="mtc_controller">ROLE 5: MTC / Document Controller</option>
                  <option value="dispatch_team">ROLE 6: Dispatch Team</option>
                  <option value="management_viewer">ROLE 7: Management / Viewer (Read-Only)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Create & Issue Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
