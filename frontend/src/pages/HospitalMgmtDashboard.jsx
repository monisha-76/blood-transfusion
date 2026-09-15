import React, { useState, useEffect } from 'react';
import { getBloodRequests, getEscalatedCases, retriggerSearch } from '../services/bloodService';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { ShieldAlert, Building2, Activity, RefreshCw, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';

export const HospitalMgmtDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [escalated, setEscalated] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [reqRes, escRes] = await Promise.all([
        getBloodRequests(),
        getEscalatedCases()
      ]);
      if (reqRes.success) setRequests(reqRes.data);
      if (escRes.success) setEscalated(escRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load hospital management dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRetrigger = async (requestId) => {
    try {
      const res = await retriggerSearch(requestId);
      if (res.success) {
        toast.success('Procurement search re-executed!');
        fetchData();
      }
    } catch (err) {
      toast.error('Search re-trigger failed');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading Hospital Management Portal...</div>;
  }

  const fulfilledCount = requests.filter(r => ['BLOOD_AVAILABLE', 'RESERVED', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(r.currentStatus)).length;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex justify-between items-center">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400">Hospital Administration</span>
          <h1 className="text-2xl font-black text-white mt-1">Hospital Management Dashboard</h1>
          <p className="text-xs text-slate-400">Blood Procurement Escalation Control & Transfusion Surveillance</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Procurement Requests" value={requests.length} subtitle="Ongoing T-10 searches" icon={Activity} color="sky" />
        <StatCard title="Day 7 Escalated Cases" value={escalated.length} subtitle="Requires urgent management intervention" icon={ShieldAlert} color="rose" />
        <StatCard title="Fulfilled / Secured Requests" value={fulfilledCount} subtitle="Secured via Stock/Donors" icon={CheckCircle2} color="emerald" />
      </div>

      {/* Day 7 Escalation Urgent Alert Card */}
      {escalated.length > 0 && (
        <div className="p-6 rounded-3xl glass-panel border border-rose-500/30 bg-rose-950/20 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-600 text-white">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">URGENT: {escalated.length} Blood Request(s) Escalated (Day 7 Search Expiry)</h3>
              <p className="text-xs text-rose-300">Required blood was not found during the standard 7-day search period. Active monitoring continues.</p>
            </div>
          </div>

          <div className="space-y-2">
            {escalated.map((esc) => (
              <div key={esc._id} className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-900/50 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-rose-400">{esc.requiredBloodGroup} Blood</span> • Patient: <span className="font-bold text-white">{esc.patient?.name}</span> • Transfusion Date: <span className="font-bold text-white">{new Date(esc.transfusionDate).toLocaleDateString()}</span>
                </div>
                <button
                  onClick={() => handleRetrigger(esc._id)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" /> Re-trigger Pipeline
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Requests Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" /> Pre-Transfusion Procurement Master Log
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Patient</th>
                <th className="p-3">Blood Group</th>
                <th className="p-3">Transfusion Date</th>
                <th className="p-3">Search Start</th>
                <th className="p-3">Source</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {requests.map((req) => (
                <tr key={req._id} className="hover:bg-slate-900/50">
                  <td className="p-3 font-semibold text-white">{req.patient?.name || 'Patient'}</td>
                  <td className="p-3 font-bold text-rose-400">{req.requiredBloodGroup}</td>
                  <td className="p-3 text-slate-300">{new Date(req.transfusionDate).toLocaleDateString()}</td>
                  <td className="p-3 text-slate-400">{new Date(req.searchStartDate).toLocaleDateString()}</td>
                  <td className="p-3 text-slate-300 font-semibold">{req.source}</td>
                  <td className="p-3"><StatusBadge status={req.currentStatus} /></td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleRetrigger(req._id)}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] transition"
                    >
                      Re-scan
                    </button>
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
