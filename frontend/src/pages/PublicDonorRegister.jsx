import React, { useState } from 'react';
import { Heart, ShieldCheck, CheckCircle2, Droplet, ArrowRight } from 'lucide-react';
import { publicRegisterDonor } from '../services/donorService';
import { toast } from 'react-toastify';

export const PublicDonorRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    bloodGroup: 'B+',
    phone: '',
    email: '',
    location: '',
    lastDonationDate: '',
    willingToDonate: true,
    healthDeclaration: true,
    consent: true
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.email || !formData.location) {
      toast.error('Please complete all required fields');
      return;
    }
    if (!formData.healthDeclaration || !formData.consent) {
      toast.error('Please confirm health declaration and consent');
      return;
    }

    setLoading(true);
    try {
      const res = await publicRegisterDonor(formData);
      if (res.success) {
        setSubmitted(true);
        toast.success('Thank you for registering as a blood donor!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="glass-panel p-10 rounded-3xl border border-emerald-500/30 bg-slate-900/90 shadow-2xl space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-white">Registration Complete!</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Your details have been successfully registered in the JeevanSetu Donor Database. If an urgent transfusion match is requested for <span className="font-bold text-rose-400">{formData.bloodGroup}</span> blood, our automated system will contact you.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Register Another Donor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="glass-panel p-8 sm:p-10 rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <h2 className="text-3xl font-extrabold text-white">Public Voluntary Donor Registration</h2>
          <p className="text-xs text-slate-400">Join our emergency blood donor network for thalassemia patients</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Priya Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Blood Group *</label>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Phone Number *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91-9876543210"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="priya@example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">City / Area Location *</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Model Town Phase 1"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Last Donation Date (if applicable)</label>
            <input
              type="date"
              value={formData.lastDonationDate}
              onChange={(e) => setFormData({ ...formData, lastDonationDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.healthDeclaration}
                onChange={(e) => setFormData({ ...formData, healthDeclaration: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-slate-300 text-[11px]">
                I declare I am healthy, weigh over 45kg, and have no infectious medical conditions.
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consent}
                onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-slate-300 text-[11px]">
                I consent to be contacted by JeevanSetu for emergency blood transfusion matches.
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.willingToDonate}
                onChange={(e) => setFormData({ ...formData, willingToDonate: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-slate-300 text-[11px] font-semibold text-rose-400">
                I confirm that I am willing and ready to donate blood if matched with an active patient requirement.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? 'Submitting Registration...' : 'Submit Voluntary Donor Registration'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
