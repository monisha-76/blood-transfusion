import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Droplet, Plus, Trash2, ShieldAlert, BarChart2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const BloodBankDashboard = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    bloodGroup: 'B+',
    component: 'PRBC',
    quantity: 1,
    expiryDate: ''
  });

  const fetchInventory = async () => {
    try {
      const res = await API.get('/blood-bank/inventory');
      if (res.data.success) {
        setInventory(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load blood inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!formData.quantity || !formData.expiryDate) {
      toast.error('Please fill quantity and expiry date');
      return;
    }
    try {
      const res = await API.post('/blood-bank/inventory', formData);
      if (res.data.success) {
        toast.success('Blood stock added successfully! (Late availability check evaluated)');
        setIsAddModalOpen(false);
        fetchInventory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add stock');
    }
  };

  const handlePurgeExpired = async () => {
    try {
      const res = await API.post('/blood-bank/inventory/purge-expired');
      if (res.data.success) {
        toast.info(res.data.message);
        fetchInventory();
      }
    } catch (err) {
      toast.error('Failed to purge expired units');
    }
  };

  // Recharts aggregated data
  const chartData = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => {
    const total = inventory
      .filter((i) => i.bloodGroup === bg && i.status === 'AVAILABLE')
      .reduce((sum, item) => sum + (item.quantity - item.reservedQuantity), 0);
    return { name: bg, units: total };
  });

  const totalAvailable = inventory.reduce((sum, i) => sum + (i.status === 'AVAILABLE' ? Math.max(0, i.quantity - i.reservedQuantity) : 0), 0);
  const totalReserved = inventory.reduce((sum, i) => sum + i.reservedQuantity, 0);

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading Blood Bank Portal...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">Inventory Management</span>
          <h1 className="text-2xl font-black text-white mt-1">Blood Bank Portal</h1>
          <p className="text-xs text-slate-400">City Central Blood Bank Inventory Control</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" /> Add Blood Batch
          </button>

          <button
            onClick={handlePurgeExpired}
            className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition"
            title="Mark Expired Stock"
          >
            <Trash2 className="w-4 h-4 text-rose-400" /> Purge Expired
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Unreserved Available Stock" value={`${totalAvailable} Units`} subtitle="Net usable PRBC stock" icon={Droplet} color="rose" />
        <StatCard title="Reserved Stock" value={`${totalReserved} Units`} subtitle="Reserved for active transfusions" icon={Droplet} color="amber" />
        <StatCard title="Total Batches" value={inventory.length} subtitle="Inventory batch records" icon={BarChart2} color="sky" />
      </div>

      {/* Recharts Breakdown Chart */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-rose-500" /> Unreserved Stock Units by Blood Group
        </h3>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
              <Bar dataKey="units" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.units > 0 ? '#f43f5e' : '#334155'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Droplet className="w-5 h-5 text-rose-500" /> Live Inventory Batches
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Blood Group</th>
                <th className="p-3">Component</th>
                <th className="p-3">Unreserved Qty</th>
                <th className="p-3">Reserved Qty</th>
                <th className="p-3">Total Qty</th>
                <th className="p-3">Expiry Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {inventory.length === 0 ? (
                <tr><td colSpan="7" className="p-4 text-center text-slate-500">No stock batches in inventory.</td></tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-900/50">
                    <td className="p-3 font-bold text-rose-400 text-sm">{item.bloodGroup}</td>
                    <td className="p-3 text-slate-300 font-semibold">{item.component}</td>
                    <td className="p-3 text-emerald-400 font-extrabold">{Math.max(0, item.quantity - item.reservedQuantity)} Unit(s)</td>
                    <td className="p-3 text-amber-400 font-bold">{item.reservedQuantity} Unit(s)</td>
                    <td className="p-3 text-white font-bold">{item.quantity} Unit(s)</td>
                    <td className="p-3 text-slate-400">{new Date(item.expiryDate).toLocaleDateString()}</td>
                    <td className="p-3"><StatusBadge status={item.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Stock Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Blood Inventory Batch">
        <form onSubmit={handleAddStock} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Blood Group</label>
            <select
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Quantity (Units)</label>
            <input
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value, 10) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Expiry Date</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition"
          >
            Add Units to Inventory
          </button>
        </form>
      </Modal>
    </div>
  );
};
