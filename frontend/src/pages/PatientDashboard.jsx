import React, { useState, useEffect } from 'react';
import { getMyPatientProfile } from '../services/patientService';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Calendar, Clock, Droplet, User, Stethoscope, Activity, FileText, Clock3, AlertCircle, Pill, Hospital, Phone, Mail, Search } from 'lucide-react';
import { toast } from 'react-toastify';

export const PatientDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await getMyPatientProfile();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePatientBloodSearch = async () => {
    setSearchLoading(true);
    try {
      const res = await API.post('/blood-requests', {
        transfusionDate: data?.patient?.nextTransfusionDate
      });
      if (res.data.success) {
        toast.success('Pre-transfusion blood search triggered for your scheduled date!');
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger blood search');
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading patient dashboard...</div>;
  }

  const { patient, assignedDoctorDetails, activeBloodRequest, transfusionHistory } = data || {};

  // If patient details haven't been created yet
  if (!patient) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
        <div className="p-8 sm:p-10 rounded-3xl glass-panel border border-slate-800 bg-slate-900/90 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
            <Clock3 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">Awaiting Doctor Assignment</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Welcome, <span className="font-bold text-white">{user?.name}</span>! Your patient profile is being synced with an assigned hematologist doctor.
          </p>
          <button
            onClick={fetchProfile}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition inline-flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-rose-400" /> Refresh Dashboard Status
          </button>
        </div>
      </div>
    );
  }

  // Days remaining calculation
  let daysRemaining = 0;
  if (patient?.nextTransfusionDate) {
    const diff = new Date(patient.nextTransfusionDate).getTime() - new Date().getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">Thalassemia Patient Portal</span>
          <h1 className="text-2xl font-black text-white mt-1">{patient?.name || user?.name}</h1>
          <p className="text-xs text-slate-400 mt-1">Diagnosis: {patient?.diagnosis || 'Thalassemia Major'} • Condition: <span className="text-emerald-400 font-bold">{patient?.patientCondition || 'Stable'}</span></p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Group</span>
            <span className="text-2xl font-black text-rose-400">{patient?.bloodGroup || 'B+'}</span>
          </div>

          <button
            onClick={handlePatientBloodSearch}
            disabled={searchLoading}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-2 transition"
          >
            <Search className="w-4 h-4" /> {searchLoading ? 'Searching...' : 'Search Blood Availability'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Next Transfusion Date"
          value={patient?.nextTransfusionDate ? new Date(patient.nextTransfusionDate).toLocaleDateString() : 'N/A'}
          subtitle={daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Due Today / Overdue'}
          icon={Calendar}
          color="rose"
        />

        <StatCard
          title="Procurement Status"
          value={activeBloodRequest ? activeBloodRequest.currentStatus.replace('_', ' ') : 'Scheduled'}
          subtitle={`Hospital: ${patient?.hospital || 'City Central Hospital'}`}
          icon={Activity}
          color={activeBloodRequest?.currentStatus === 'BLOOD_AVAILABLE' ? 'emerald' : 'amber'}
        />

        <StatCard
          title="Transfusion Frequency"
          value={`Every ${patient?.transfusionFrequency || 21} Days`}
          subtitle={`Last: ${patient?.lastTransfusionDate ? new Date(patient.lastTransfusionDate).toLocaleDateString() : 'N/A'}`}
          icon={Clock}
          color="sky"
        />

        <StatCard
          title="Assigned Doctor"
          value={assignedDoctorDetails?.name || 'Dr. Kumar'}
          subtitle={assignedDoctorDetails?.specialization || 'Hematologist'}
          icon={Stethoscope}
          color="purple"
        />
      </div>

      {/* MY DOCTOR SECTION (Requirement #2 & #14) */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-purple-400" /> MY DOCTOR
          </h3>
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Assignment Status: {assignedDoctorDetails?.status || 'Active'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">Doctor Name</span>
            <span className="text-white font-bold text-sm block text-purple-300">{assignedDoctorDetails?.name || 'Dr. Kumar'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">Specialization</span>
            <span className="text-white font-semibold text-xs block flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-sky-400" /> {assignedDoctorDetails?.specialization || 'Hematology'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">Hospital</span>
            <span className="text-white font-semibold text-xs block flex items-center gap-1.5">
              <Hospital className="w-3.5 h-3.5 text-rose-400" /> {assignedDoctorDetails?.hospital || 'City Central Hospital'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
            <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">Contact</span>
            <span className="text-slate-300 text-xs block flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> {assignedDoctorDetails?.phone || '+91-9876543210'}
            </span>
          </div>
        </div>
      </div>

      {/* MY MEDICAL INFORMATION & TREATMENT PLAN */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Pill className="w-5 h-5 text-emerald-400" /> Medical Information & Prescriptions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Prescribed Medicines</span>
              <span className="text-emerald-400 font-semibold">{patient?.medicineFrequency || 'Daily'}</span>
            </div>
            <p className="text-white font-bold text-sm">{patient?.medicinesPrescribed || 'Deferasirox 500mg, Folic Acid 5mg'}</p>
            <p className="text-slate-400">Dosage: <span className="text-slate-200">{patient?.medicineDosage || '1 tablet once daily after meal'}</span></p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Doctor Clinical Notes & Follow-up</span>
              <span className="text-purple-400 font-semibold">Follow-up: {patient?.followUpDate ? new Date(patient.followUpDate).toLocaleDateString() : 'Scheduled'}</span>
            </div>
            <p className="text-slate-300 italic">{patient?.treatmentNotes || 'Maintain hemoglobin level above 9.5 g/dL. Continue regular chelating therapy.'}</p>
            <p className="text-slate-400 text-[11px]">Required Component: <span className="text-rose-400 font-bold">{patient?.requiredComponent || 'PRBC'}</span></p>
          </div>
        </div>
      </div>

      {/* Active Procurement Status Tracker Card */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Droplet className="w-5 h-5 text-rose-500" /> Active Pre-Transfusion Blood Search Tracker
          </h3>
          {activeBloodRequest && <StatusBadge status={activeBloodRequest.currentStatus} />}
        </div>

        {activeBloodRequest ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="text-slate-500 font-semibold block">Required Quantity:</span>
                <span className="text-white font-bold">{activeBloodRequest.requiredQuantity} PRBC Unit(s)</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Search Initiated:</span>
                <span className="text-white font-bold">{new Date(activeBloodRequest.searchStartDate).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500 font-semibold block">Blood Source Secured:</span>
                <span className="text-white font-bold">{activeBloodRequest.source || 'Pending Search'}</span>
              </div>
            </div>

            {/* Workflow Progress Steps */}
            <div className="grid grid-cols-4 gap-2 text-center pt-2">
              <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                ['INVENTORY_CHECK', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(activeBloodRequest.currentStatus)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                1. T-10 Auto Search
              </div>

              <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                ['DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(activeBloodRequest.currentStatus)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                2. Donor Coordination
              </div>

              <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                ['BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(activeBloodRequest.currentStatus)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                3. Doctor Approval
              </div>

              <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                activeBloodRequest.currentStatus === 'COMPLETED'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                4. Completed
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-xs py-4">No active blood requests currently pending. Click "Search Blood Availability" above to trigger a check for your next date.</p>
        )}
      </div>

      {/* Transfusion History Table */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-rose-500" /> Transfusion History Log
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Blood Group</th>
                <th className="p-3">Units</th>
                <th className="p-3">Source</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {!transfusionHistory || transfusionHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-slate-500">No past transfusion logs recorded yet.</td>
                </tr>
              ) : (
                transfusionHistory.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-white">{new Date(t.transfusionDate).toLocaleDateString()}</td>
                    <td className="p-3 text-rose-400 font-bold">{t.bloodGroup}</td>
                    <td className="p-3 text-slate-300">{t.quantity} Unit(s)</td>
                    <td className="p-3 text-slate-300">{t.source}</td>
                    <td className="p-3"><StatusBadge status={t.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
