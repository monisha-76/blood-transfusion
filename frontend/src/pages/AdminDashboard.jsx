



import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { StatCard } from '../components/StatCard';
import { Settings, Users, Droplet, Activity, ShieldCheck, Database, CheckCircle2, Stethoscope, Scale } from 'lucide-react';
import { toast } from 'react-toastify';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        API.get('/admin/stats'),
        API.get('/admin/users')
      ]);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (usersRes.data.success) setUsers(usersRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load admin statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await API.put(`/admin/users/${userId}/role`, { role: newRole });
      if (res.data.success) {
        toast.success('User role updated');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading System Admin Console...</div>;
  }

  const doctorWorkload = stats?.doctorWorkload || [];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-500">System Administration</span>
          <h1 className="text-2xl font-black text-white mt-1">Admin Console</h1>
          <p className="text-xs text-slate-400">JeevanSetu Dynamic Doctor Load-Balancing & System Surveillance</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Registered Users" value={stats?.totalUsers || 0} subtitle="All platform accounts" icon={Users} color="rose" />
        <StatCard title="Thalassemia Patients" value={stats?.totalPatients || 0} subtitle="Active patient profiles" icon={Activity} color="sky" />
        <StatCard title="Voluntary Donors" value={stats?.totalDonors || 0} subtitle="Registered blood donors" icon={Droplet} color="emerald" />
        <StatCard title="Completed Transfusions" value={stats?.completedTransfusions || 0} subtitle="Successful transfusions" icon={CheckCircle2} color="purple" />
      </div>

      {/* DYNAMIC DOCTOR WORKLOAD LOAD-BALANCING TABLE (#1 & #15) */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-sky-400" /> Dynamic Doctor Workload & Patient Assignment Distribution
          </h3>
          <span className="text-xs text-slate-400">Database-Driven Lowest-Load Allocation</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Doctor Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Current Patient Count</th>
                <th className="p-3">Load Status</th>
                <th className="p-3">Assigned Patient Roster</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {doctorWorkload.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500">No active doctor accounts found.</td>
                </tr>
              ) : (
                doctorWorkload.map((doc) => (
                  <tr key={doc.doctorId} className="hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-purple-400" /> {doc.name}
                    </td>
                    <td className="p-3 text-slate-300">{doc.email}</td>
                    <td className="p-3 text-white font-extrabold text-sm">{doc.patientCount} Patient(s)</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        doc.patientCount === Math.min(...doctorWorkload.map(d => d.patientCount))
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {doc.patientCount === Math.min(...doctorWorkload.map(d => d.patientCount)) ? 'Lowest Load (Next Target)' : 'Active'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {doc.assignedPatients?.map(p => p.name).join(', ') || 'No patients'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Directory Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-rose-500" /> Platform User Directory & RBAC Roles
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">User Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Current Role</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Modify Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-900/50">
                  <td className="p-3 font-semibold text-white">{u.name}</td>
                  <td className="p-3 text-slate-300">{u.email}</td>
                  <td className="p-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-rose-400 border border-slate-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{u.phone || 'N/A'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-rose-500"
                    >
                      {['ADMIN', 'PATIENT', 'DOCTOR', 'BLOOD_BANK', 'DONOR', 'HOSPITAL_MANAGEMENT'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
