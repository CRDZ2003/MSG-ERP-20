import React, { useState } from 'react'
import { db } from '../../services/db'
import { ScrollText, Search, Shield, Clock } from 'lucide-react'

export const AuditLogsView: React.FC = () => {
  const audits = db.getAudits()
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = audits.filter(a =>
    a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.record_id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ScrollText className="h-5 w-5 text-indigo-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Security & Operation Audit Trail</h1>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 23 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident system activity log capturing user actions, stock adjustments, order cancellations, and approval signatures.
          </p>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Logged Events: <strong className="text-slate-800">{audits.length} Records</strong>
        </span>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, user email, module, record ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B2545] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">User Email</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3">Action Performed</th>
                <th className="py-3 px-3">Record ID</th>
                <th className="py-3 px-3">Details / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No audit records found matching search.
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">{a.timestamp}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{a.user_email}</td>
                    <td className="py-2.5 px-3">
                      <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[10px]">
                        {a.module}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{a.action}</td>
                    <td className="py-2.5 px-3 font-mono text-red-700 font-bold">{a.record_id}</td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-sm">
                      {a.reason && <span className="font-semibold block text-slate-700">{a.reason}</span>}
                      {a.new_values && <span className="font-mono text-[10px] text-slate-400 truncate block">{a.new_values}</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
