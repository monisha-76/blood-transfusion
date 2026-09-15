import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Droplet, ShieldCheck, Heart, Calendar, ArrowRight, Activity, 
  Users, Building2, Stethoscope, AlertCircle 
} from 'lucide-react';

export const Landing = () => {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl glass-panel p-8 sm:p-14 border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 text-center sm:text-left">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-3xl space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold tracking-wide uppercase">
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Automated Blood Transfusion Management
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
            Saving Thalassemia Lives with <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400">Automated Blood Procurement</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            JeevanSetu connects patients, doctors, blood banks, registered donors, and hospital management. Our predictive T-10 system initiates multi-tier blood search 10 days before scheduled transfusions to guarantee zero delays.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/public-donor-register"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-sm shadow-xl shadow-rose-600/30 flex items-center gap-2 transition"
            >
              <Heart className="w-4 h-4 fill-white" /> Register as Potential Donor
            </Link>

            <Link
              to="/login"
              className="px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm flex items-center gap-2 transition"
            >
              Sign In to Portal <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Level Procurement Workflow Section */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">4-Level Pre-Transfusion Workflow</h2>
          <p className="text-sm text-slate-400">
            Automated procurement starts 10 days prior to predicted transfusion dates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-sm">
              L1
            </div>
            <h3 className="font-bold text-white text-base">Blood Bank Stock</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Instant verification & reservation of compatible PRBC units in hospital inventory.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-extrabold text-sm">
              L2
            </div>
            <h3 className="font-bold text-white text-base">Registered Donors</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Smart matching algorithm contacts eligible registered donors based on interval and blood group.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-extrabold text-sm">
              L3
            </div>
            <h3 className="font-bold text-white text-base">Public Campaign</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Launches public donor campaign for guest donor intake when registered donors are unavailable.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-extrabold text-sm">
              L4
            </div>
            <h3 className="font-bold text-white text-base">Day 7 Escalation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Urgent notification to Hospital Management if blood remains unfulfilled after 7 days search.
            </p>
          </div>
        </div>
      </section>

      {/* Role Sign In Quick Cards */}
      <section className="space-y-6">
        <h2 className="text-2xl font-extrabold text-white">System Portals</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/login" className="p-5 rounded-2xl glass-panel border border-slate-800 glass-card-hover flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Patient Portal</h4>
              <p className="text-xs text-slate-400">Track schedule & request status</p>
            </div>
          </Link>

          <Link to="/login" className="p-5 rounded-2xl glass-panel border border-slate-800 glass-card-hover flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Doctor Portal</h4>
              <p className="text-xs text-slate-400">Clinical approvals & patient roster</p>
            </div>
          </Link>

          <Link to="/login" className="p-5 rounded-2xl glass-panel border border-slate-800 glass-card-hover flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Blood Bank Portal</h4>
              <p className="text-xs text-slate-400">Manage stock & reservations</p>
            </div>
          </Link>

          <Link to="/login" className="p-5 rounded-2xl glass-panel border border-slate-800 glass-card-hover flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Donor Portal</h4>
              <p className="text-xs text-slate-400">Respond to donation requests</p>
            </div>
          </Link>

          <Link to="/login" className="p-5 rounded-2xl glass-panel border border-slate-800 glass-card-hover flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Hospital Management</h4>
              <p className="text-xs text-slate-400">Escalation monitoring & campaigns</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};
