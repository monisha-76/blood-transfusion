import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import API from '../services/api';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { Users, CheckCircle2, Clock, Activity, FileText, ShieldAlert, UserPlus, Search, Pill, Edit3, HeartPulse } from 'lucide-react';
import { toast } from 'react-toastify';

export const DoctorDashboard = () => {
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection states
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isEditMedicalModalOpen, setIsEditMedicalModalOpen] = useState(false);
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState('');

  // Medical Record Form
  const [medicalForm, setMedicalForm] = useState({
    patientCondition: 'Stable',
    diagnosis: 'Thalassemia Major',
    bloodGroup: 'B+',
    requiredComponent: 'PRBC',
    medicinesPrescribed: '',
    medicineDosage: '',
    medicineFrequency: '',
    treatmentNotes: '',
    followUpDate: '',
    transfusionFrequency: 21
  });

  // Add Patient Form
  const [patientForm, setPatientForm] = useState({
    name: '',
    email: '',
    phone: '',
    bloodGroup: 'B+',
    dateOfBirth: '',
    gender: 'MALE',
    transfusionFrequency: 21,
    lastTransfusionDate: '',
    diagnosis: 'Thalassemia Major',
    medicalHistory: '',
    hospital: 'City Central Hospital'
  });

  const fetchData = async () => {
    try {
      const [patRes, appRes, notifRes] = await Promise.all([
        API.get('/doctors/patients'),
        API.get('/doctors/approvals'),
        API.get('/notifications')
      ]);
      if (patRes.data.success) setPatients(patRes.data.data);
      if (appRes.data.success) setApprovals(appRes.data.data);
      if (notifRes.data.success) setNotifications(notifRes.data.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load doctor portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle route-based scrolling to My Patients or Doctor Approvals
  useEffect(() => {
    if (location.pathname === '/doctor/patients') {
      const el = document.getElementById('my-patients-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else if (location.pathname === '/doctor/approvals') {
      const el = document.getElementById('pending-approvals-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.pathname, loading]);

  const handleOpenMedicalModal = (patient) => {
    setSelectedPatient(patient);
    setMedicalForm({
      patientCondition: patient.patientCondition || 'Stable',
      diagnosis: patient.diagnosis || 'Thalassemia Major',
      bloodGroup: patient.bloodGroup || 'B+',
      requiredComponent: patient.requiredComponent || 'PRBC',
      medicinesPrescribed: patient.medicinesPrescribed || '',
      medicineDosage: patient.medicineDosage || '',
      medicineFrequency: patient.medicineFrequency || '',
      treatmentNotes: patient.treatmentNotes || '',
      followUpDate: patient.followUpDate ? new Date(patient.followUpDate).toISOString().split('T')[0] : '',
      transfusionFrequency: patient.transfusionFrequency || 21
    });
    setIsEditMedicalModalOpen(true);
  };

  const handleUpdateMedicalRecords = async (e) => {
    e.preventDefault();
    if (!selectedPatient) return;
    try {
      const res = await API.put(`/patients/${selectedPatient._id}/medical-records`, medicalForm);
      if (res.data.success) {
        toast.success(`Medical record for ${selectedPatient.name} updated!`);
        setIsEditMedicalModalOpen(false);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update medical record');
    }
  };

  const handleDoctorSearchBlood = async (patientId) => {
    try {
      const res = await API.post('/blood-requests', { patientId });
      if (res.data.success) {
        toast.success('Pre-transfusion blood search triggered for assigned patient!');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger blood search');
    }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!patientForm.name || !patientForm.email || !patientForm.bloodGroup || !patientForm.lastTransfusionDate) {
      toast.error('Please fill in required patient fields');
      return;
    }
    try {
      const res = await API.post('/patients', patientForm);
      if (res.data.success) {
        toast.success(`Patient ${patientForm.name} registered and assigned!`);
        setIsAddPatientModalOpen(false);
        setPatientForm({
          name: '', email: '', phone: '', bloodGroup: 'B+', dateOfBirth: '', gender: 'MALE',
          transfusionFrequency: 21, lastTransfusionDate: '', diagnosis: 'Thalassemia Major',
          medicalHistory: '', hospital: 'City Central Hospital'
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register patient');
    }
  };

  const handleApprove = async (bloodRequestId, action) => {
    try {
      const res = await API.post('/doctors/approve-transfusion', {
        bloodRequestId,
        action,
        doctorNotes
      });
      if (res.data.success) {
        toast.success(`Transfusion request ${action.toLowerCase()}d!`);
        setSelectedRequest(null);
        setDoctorNotes('');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleConfirmBloodSecured = async (bloodRequestId) => {
    try {
      const res = await API.post('/doctors/confirm-blood-secured', { bloodRequestId });
      if (res.data.success) {
        toast.success('Blood secured confirmed! Status updated to Ready for Transfusion.');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm blood');
    }
  };

  const handleComplete = async (bloodRequestId) => {
    try {
      const res = await API.post('/doctors/complete-transfusion', { bloodRequestId });
      if (res.data.success) {
        toast.success('Transfusion completed! Removed from pending, and patient record updated with new predicted date.');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete transfusion');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading Doctor Portal...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400">Clinical Hematology Portal</span>
          <h1 className="text-2xl font-black text-white mt-1">Doctor Dashboard</h1>
          <p className="text-xs text-slate-400">Assigned Patient Care, Medical Information & Transfusion Approvals</p>
        </div>

        <button
          onClick={() => setIsAddPatientModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> Add New Patient
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="My Assigned Patients"
          value={patients.length}
          subtitle="Patients under your direct care"
          icon={Users}
          color="sky"
        />

        <StatCard
          title="Pending Approvals"
          value={approvals.length}
          subtitle="Transfusions within 10 days"
          icon={Activity}
          color="rose"
        />

        <StatCard
          title="Clinical Hospital"
          value="City Central Hospital"
          subtitle="Department of Hematology"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      {/* SCOPED NOTIFICATIONS SECTION (#5) */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3 bg-slate-950/60">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-rose-500" /> Notifications for Your Assigned Patients
        </h3>
        {notifications.length === 0 ? (
          <p className="text-slate-500 text-xs py-2">No new notifications for your assigned patients.</p>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 3).map((n) => (
              <div key={n._id} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">{n.title}</span>
                  <span className="text-slate-400">{n.message}</span>
                </div>
                <span className="text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PENDING BLOOD TRANSFUSION APPROVALS TABLE (#3, #4, #7) */}
      <div id="pending-approvals-section" className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-500" /> Pending Blood Transfusion Approvals
          </h3>
          <span className="text-xs text-slate-400">Review & Approve Transfusions for Your Patients</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Patient</th>
                <th className="p-3">Blood Group</th>
                <th className="p-3">Transfusion Date</th>
                <th className="p-3">Procurement Status & Multi-Level Search Stepper</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">No transfusion requests currently pending for your assigned patients.</td>
                </tr>
              ) : (
                approvals.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-900/50">
                    <td className="p-3 font-semibold text-white">{req.patient?.name || 'Assigned Patient'}</td>
                    <td className="p-3 text-rose-400 font-bold">{req.requiredBloodGroup}</td>
                    <td className="p-3 text-slate-300">{new Date(req.transfusionDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        <StatusBadge status={req.currentStatus} />
                        {/* Blood Search Workflow Stepper */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
                          <span className={`px-1.5 py-0.5 rounded ${
                            ['INVENTORY_CHECK', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(req.currentStatus)
                              ? req.source === 'BLOOD_BANK' || ['BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(req.currentStatus) && req.source === 'BLOOD_BANK'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                                : 'bg-slate-800 text-slate-400'
                              : 'bg-slate-900 text-slate-600'
                          }`}>
                            1. Blood Bank {req.source === 'BLOOD_BANK' ? '✓ Secured' : 'Searched'}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            ['DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(req.currentStatus)
                              ? req.source === 'REGISTERED_DONOR'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-900 text-slate-600'
                          }`}>
                            2. Donors {req.source === 'REGISTERED_DONOR' ? '✓ Secured' : 'Searching'}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            ['PUBLIC_RECRUITMENT', 'UNAVAILABLE_ESCALATED', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'COMPLETED'].includes(req.currentStatus)
                              ? req.source === 'PUBLIC_DONOR'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-slate-900 text-slate-600'
                          }`}>
                            3. Public Campaign {req.source === 'PUBLIC_DONOR' ? '✓ Secured' : 'Active'}
                          </span>
                          <span className="text-slate-600">→</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            ['READY_FOR_TRANSFUSION', 'COMPLETED'].includes(req.currentStatus)
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-slate-900 text-slate-600'
                          }`}>
                            4. Ready for Transfusion
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {/* State 1: READY_FOR_TRANSFUSION -> Show Complete Transfusion button */}
                      {req.currentStatus === 'READY_FOR_TRANSFUSION' || req.doctorApprovalStatus === 'APPROVED' ? (
                        <button
                          onClick={() => handleComplete(req._id)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/30 ml-auto"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Complete Transfusion
                        </button>
                      ) : req.currentStatus === 'BLOOD_AVAILABLE' || (req.source && req.source !== 'UNASSIGNED') ? (
                        /* State 2: Blood Secured -> Show Blood Secured notice + OK / Confirm button */
                        <div className="flex flex-col items-end gap-1.5 ml-auto">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Blood Secured – Ready for Transfusion
                          </span>
                          <button
                            onClick={() => handleConfirmBloodSecured(req._id)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 transition"
                          >
                            OK / Confirm
                          </button>
                        </div>
                      ) : (
                        /* State 3: Blood search in progress -> Show Blood Searching... */
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[11px] flex items-center gap-1.5 animate-pulse">
                            <Activity className="w-3.5 h-3.5" /> Blood Searching...
                          </span>
                          <span className="text-[10px] text-slate-500">Searching inventory & donors</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MY PATIENTS SECTION (#6, #8, #11) */}
      <div id="my-patients-section" className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" /> MY PATIENTS (Assigned Roster)
          </h3>
          <span className="text-xs text-slate-400">Total Patients: {patients.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="p-3">Patient ID / Name</th>
                <th className="p-3">Blood Group</th>
                <th className="p-3">Condition</th>
                <th className="p-3">Prescribed Medicine</th>
                <th className="p-3">Predicted Next Date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">No patients assigned to you yet. New patients will be dynamically load-balanced to your care.</td>
                </tr>
              ) : (
                patients.map((pat) => (
                  <tr key={pat._id} className="hover:bg-slate-900/50">
                    <td className="p-3">
                      <span className="font-bold text-white block">{pat.name}</span>
                      <span className="text-[10px] text-slate-500">ID: P-{pat._id.toString().slice(-5).toUpperCase()}</span>
                    </td>
                    <td className="p-3 text-rose-400 font-bold">{pat.bloodGroup}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        pat.patientCondition === 'Critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {pat.patientCondition || 'Stable'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{pat.medicinesPrescribed || 'Deferasirox 500mg'}</td>
                    <td className="p-3 text-emerald-400 font-bold">{new Date(pat.nextTransfusionDate).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenMedicalModal(pat)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/50 text-purple-300 font-bold text-xs inline-flex items-center gap-1 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Manage Medical Info
                      </button>

                      <button
                        onClick={() => handleDoctorSearchBlood(pat._id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-xs inline-flex items-center gap-1 transition"
                      >
                        <Search className="w-3.5 h-3.5" /> Blood Search
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MEDICAL INFORMATION & TREATMENT PLAN MODAL (#8) */}
      <Modal isOpen={isEditMedicalModalOpen} onClose={() => setIsEditMedicalModalOpen(false)} title={`Medical Information & Treatment Plan - ${selectedPatient?.name}`}>
        <form onSubmit={handleUpdateMedicalRecords} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Patient Condition</label>
              <select
                value={medicalForm.patientCondition}
                onChange={(e) => setMedicalForm({ ...medicalForm, patientCondition: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="Stable">Stable</option>
                <option value="Critical">Critical</option>
                <option value="Requires Transfusion">Requires Immediate Transfusion</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Required Blood Component</label>
              <select
                value={medicalForm.requiredComponent}
                onChange={(e) => setMedicalForm({ ...medicalForm, requiredComponent: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="PRBC">Packed Red Blood Cells (PRBC)</option>
                <option value="WHOLE_BLOOD">Whole Blood</option>
                <option value="PLATELETS">Platelets</option>
                <option value="PLASMA">Fresh Frozen Plasma</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Medicines Prescribed</label>
              <input
                type="text"
                value={medicalForm.medicinesPrescribed}
                onChange={(e) => setMedicalForm({ ...medicalForm, medicinesPrescribed: e.target.value })}
                placeholder="e.g. Deferasirox, Folic Acid"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Dosage & Frequency</label>
              <input
                type="text"
                value={medicalForm.medicineDosage}
                onChange={(e) => setMedicalForm({ ...medicalForm, medicineDosage: e.target.value })}
                placeholder="e.g. 500mg once daily after breakfast"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Clinical Treatment Notes & Observations</label>
            <textarea
              rows="3"
              value={medicalForm.treatmentNotes}
              onChange={(e) => setMedicalForm({ ...medicalForm, treatmentNotes: e.target.value })}
              placeholder="Enter hemoglobin targets, iron chelation observations, clinical notes..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
            ></textarea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Follow-up Clinical Date</label>
              <input
                type="date"
                value={medicalForm.followUpDate}
                onChange={(e) => setMedicalForm({ ...medicalForm, followUpDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Transfusion Frequency (Days)</label>
              <input
                type="number"
                value={medicalForm.transfusionFrequency}
                onChange={(e) => setMedicalForm({ ...medicalForm, transfusionFrequency: parseInt(e.target.value, 10) })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition"
          >
            Save Medical Record & Prescriptions
          </button>
        </form>
      </Modal>

      {/* ADD PATIENT MODAL */}
      <Modal isOpen={isAddPatientModalOpen} onClose={() => setIsAddPatientModalOpen(false)} title="Register New Thalassemia Patient">
        <form onSubmit={handleAddPatient} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Patient Full Name *</label>
              <input
                type="text"
                value={patientForm.name}
                onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                placeholder="Rohan Verma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Blood Group *</label>
              <select
                value={patientForm.bloodGroup}
                onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                value={patientForm.email}
                onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                placeholder="patient@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Last Transfusion Date *</label>
              <input
                type="date"
                value={patientForm.lastTransfusionDate}
                onChange={(e) => setPatientForm({ ...patientForm, lastTransfusionDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 text-white font-bold text-xs shadow-lg transition"
          >
            Register Patient
          </button>
        </form>
      </Modal>
    </div>
  );
};
