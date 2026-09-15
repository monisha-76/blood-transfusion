import React, { useState, useEffect } from 'react';
import { getMyDonorProfile, updateDonorProfile, getPendingDonorRequests, respondToDonorRequest } from '../services/donorService';
import { StatCard } from '../components/StatCard';
import { Heart, CheckCircle2, XCircle, Clock, Droplet, MapPin, Activity, Phone, AlertTriangle, User, Hospital, Home } from 'lucide-react';
import { toast } from 'react-toastify';

export const DonorDashboard = () => {
  const [donor, setDonor] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [donRes, reqRes] = await Promise.all([
        getMyDonorProfile(),
        getPendingDonorRequests()
      ]);
      if (donRes.success) setDonor(donRes.data);
      if (reqRes.success) setRequests(reqRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load donor dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleAvailability = async () => {
    const newStatus = donor.availabilityStatus === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    try {
      const res = await updateDonorProfile({ availabilityStatus: newStatus });
      if (res.success) {
        setDonor(res.data);
        toast.success(`Availability status set to ${newStatus}`);
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleRespond = async (bloodRequestId, action) => {
    try {
      const res = await respondToDonorRequest(bloodRequestId, action);
      if (res.success) {
        if (action === 'ACCEPTED') {
          toast.success('Thank you! Marked as Ready to Donate. Blood search for this patient is now secured.');
        } else {
          toast.info('Marked Not Ready.');
        }
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit response');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-sm">Loading Donor Portal...</div>;
  }

  // Calculate Urgency Condition for a request
  const getUrgencyBadge = (req) => {
    const condition = req.patient?.patientCondition;
    let daysRemaining = 10;
    if (req.transfusionDate) {
      const diff = new Date(req.transfusionDate).getTime() - new Date().getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    if (condition === 'Critical' || daysRemaining <= 3 || req.currentStatus === 'UNAVAILABLE_ESCALATED') {
      return {
        label: 'URGENT / CRITICAL',
        colorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse',
        icon: AlertTriangle
      };
    } else if (daysRemaining <= 7) {
      return {
        label: 'SERIOUS',
        colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: Clock
      };
    }
    return {
      label: 'NORMAL SCHEDULED',
      colorClass: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      icon: Activity
    };
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">Voluntary Donor Network</span>
          <h1 className="text-2xl font-black text-white mt-1">{donor?.name || 'Donor Profile'}</h1>
          <p className="text-xs text-slate-400">Blood Group: <span className="font-bold text-rose-400">{donor?.bloodGroup}</span> • Location: {donor?.location}</p>
        </div>

        <button
          onClick={toggleAvailability}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition ${
            donor?.availabilityStatus === 'AVAILABLE'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
          }`}
        >
          Status: {donor?.availabilityStatus} (Click to toggle)
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="My Blood Group" value={donor?.bloodGroup || 'B+'} subtitle="Eligible for donation" icon={Heart} color="rose" />
        <StatCard title="Total Donations" value={`${donor?.totalDonations || 0} Times`} subtitle="Lives impacted" icon={CheckCircle2} color="emerald" />
        <StatCard title="Pending Requests" value={requests.length} subtitle="Urgent requests matching your profile" icon={Activity} color="amber" />
      </div>

      {/* Active Donation Requests List with Detailed Patient Information */}
      <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" /> Pending Blood Donation Requests
          </h3>
          <span className="text-xs text-slate-400">Matching Compatible Recipients</span>
        </div>

        <div className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-slate-500 text-xs py-8 text-center">No pending blood donation requests currently matching your profile.</p>
          ) : (
            requests.map((req) => {
              const urgency = getUrgencyBadge(req);
              const UrgencyIcon = urgency.icon;

              return (
                <div key={req._id} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-slate-700 transition shadow-xl">
                  {/* Left Column: Request Details & Urgency Condition */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 font-black text-sm">
                        {req.requiredBloodGroup} Required
                      </span>

                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold border flex items-center gap-1 uppercase tracking-wider ${urgency.colorClass}`}>
                        <UrgencyIcon className="w-3.5 h-3.5" /> Condition: {urgency.label}
                      </span>

                      <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-bold">
                        Transfusion Date: {new Date(req.transfusionDate).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Patient Information Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      <div className="space-y-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Patient Details</span>
                        <p className="text-white font-bold text-sm flex items-center gap-1.5">
                          <User className="w-4 h-4 text-purple-400" /> {req.patient?.name || 'Thalassemia Patient'}
                        </p>
                        <p className="text-slate-400 text-[11px]">Diagnosis: <span className="text-slate-200">{req.patient?.diagnosis || 'Thalassemia Major'}</span></p>
                      </div>

                      <div className="space-y-1 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-slate-500 font-semibold block text-[10px] uppercase">Contact & Location</span>
                        <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> Contact: {req.patient?.phone || '+91-9876543210'}
                        </p>
                        <p className="text-slate-300 flex items-center gap-1.5 text-[11px]">
                          <Hospital className="w-3.5 h-3.5 text-rose-400" /> {req.hospital || req.patient?.hospital || 'City Central Hospital'}
                        </p>
                        <p className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                          <Home className="w-3.5 h-3.5 text-sky-400" /> Address: {req.patient?.address || 'City Center'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Ready to Donate / Not Ready Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch justify-center gap-2.5 min-w-[200px]">
                    <button
                      onClick={() => handleRespond(req._id, 'ACCEPTED')}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition transform active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Ready to Donate
                    </button>

                    <button
                      onClick={() => handleRespond(req._id, 'REJECTED')}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <XCircle className="w-4 h-4 text-slate-500" /> Not Ready
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
