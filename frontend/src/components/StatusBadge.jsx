import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Activity, ShieldAlert, HeartHandshake } from 'lucide-react';

const STATUS_CONFIG = {
  BLOOD_AVAILABLE: { label: 'Blood Available', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  RESERVED: { label: 'Units Reserved', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  READY_FOR_TRANSFUSION: { label: 'Ready for Transfusion', bg: 'bg-teal-500/10 text-teal-300 border-teal-500/30', icon: Activity },
  COMPLETED: { label: 'Transfusion Completed', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: CheckCircle2 },
  INVENTORY_CHECK: { label: 'Inventory Check', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30', icon: Clock },
  DONOR_SEARCH: { label: 'Donor Search Active', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse', icon: Clock },
  DONOR_NOTIFICATION: { label: 'Donor Contact Active', bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse', icon: HeartHandshake },
  PUBLIC_RECRUITMENT: { label: 'Public Campaign Active', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30 animate-pulse', icon: Activity },
  UNAVAILABLE_ESCALATED: { label: 'Escalated to Hospital Mgmt', bg: 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse font-semibold', icon: ShieldAlert },
  PENDING: { label: 'Pending Processing', bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30', icon: Clock },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-800 text-slate-500 border-slate-700', icon: AlertTriangle }
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || { label: status || 'Unknown', bg: 'bg-slate-800 text-slate-400 border-slate-700', icon: Clock };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${config.bg}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};
