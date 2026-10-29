import React, { useState } from 'react'
import { db } from '../../services/db'
import { useAuth } from '../../context/AuthContext'
import { Boxes, Plus, Search, CheckCircle2, XCircle } from 'lucide-react'

export const ItemMaster: React.FC = () => {
  const { hasPermission, currentUser } = useAuth()
  const items = db.getItems()
  const [searchTerm, setSearchTerm] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const [itemCode, setItemCode] = useState('')
  const [description, setDescription] = useState('')
  const [materialGrade, setMaterialGrade] = useState('SS316/316L')
  const [specification, setSpecification] = useState('ASTM A182 / ASME B16.5')
  const [size, setSize] = useState('2" #150')
  const [uom, setUom] = useState('PCS')
  const [unitPrice, setUnitPrice] = useState(50)

  const canEdit = hasPermission(['super_admin', 'admin_inventory'])

  const filtered = items.filter(it =>
    it.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    it.item_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    it.material_grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    it.specification.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemCode.trim() || !description.trim()) {
      alert('Please fill mandatory item fields.')
      return
    }

    const res = db.addItem({
      item_code: itemCode.trim().toUpperCase(),
      item_description: description.trim(),
      material_grade: materialGrade,
      specification: specification,
      size: size,
      uom: uom,
      unit_price_aed: Number(unitPrice),
      is_active: true
    }, currentUser?.email || 'admin@msgoilfield.ae')

    if (res.success) {
      alert(`Item ${itemCode} successfully added to Item Master!`)
      setIsAddModalOpen(false)
      setItemCode('')
      setDescription('')
    } else {
      alert(res.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Boxes className="h-5 w-5 text-red-600" />
            <h1 className="text-base font-bold text-slate-900 uppercase tracking-tight">Master Item Catalog</h1>
            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Section 5.4 Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Standard specifications, ASME ratings, material grades (A105N, SS316, A234 WPB), and sizing catalogs.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-colors flex items-center space-x-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item Specification</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Item Code, Grade, Specification, Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-slate-800"
          />
        </div>
      </div>

      {/* Item Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B2545] text-white uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">Item Code</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Material Grade</th>
                <th className="py-3 px-3">Specification</th>
                <th className="py-3 px-3">Size / Rating</th>
                <th className="py-3 px-3 text-center">UOM</th>
                <th className="py-3 px-3 text-center">Unit Price (AED)</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(it => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{it.item_code}</td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-md">{it.item_description}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{it.material_grade}</td>
                  <td className="py-2.5 px-3 text-slate-600">{it.specification}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">{it.size}</td>
                  <td className="py-2.5 px-3 text-center font-bold">{it.uom}</td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                    AED {it.unit_price_aed?.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0B2545] p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase">Add Product Specification</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WSO50150F316"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Material Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2'' Flange SORF CL150 SS316/SS316L"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material Grade</label>
                  <input
                    type="text"
                    value={materialGrade}
                    onChange={(e) => setMaterialGrade(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Specification Standard</label>
                  <input
                    type="text"
                    value={specification}
                    onChange={(e) => setSpecification(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Size / Class</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">UOM</label>
                  <input
                    type="text"
                    value={uom}
                    onChange={(e) => setUom(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Price AED</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow"
                >
                  Save to Item Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
