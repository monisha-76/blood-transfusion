import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, Calendar, Droplet, HeartHandshake, 
  ShieldAlert, Settings, FileText, Activity 
} from 'lucide-react';

export const Sidebar = () => {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  const navItems = [
    { label: 'Overview Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['PATIENT', 'DOCTOR', 'BLOOD_BANK', 'DONOR', 'HOSPITAL_MANAGEMENT', 'ADMIN'] },
    { label: 'My Patients', path: '/doctor/patients', icon: Users, roles: ['DOCTOR'] },
    { label: 'Doctor Approvals', path: '/doctor/approvals', icon: Activity, roles: ['DOCTOR'] },
    { label: 'Blood Inventory', path: '/blood-bank/inventory', icon: Droplet, roles: ['BLOOD_BANK', 'HOSPITAL_MANAGEMENT', 'ADMIN'] },
    { label: 'Donation Requests', path: '/donor/requests', icon: HeartHandshake, roles: ['DONOR'] },
    { label: 'Procurement Requests', path: '/hospital/requests', icon: FileText, roles: ['HOSPITAL_MANAGEMENT', 'ADMIN'] },
    { label: 'Escalated Cases (Day 7)', path: '/hospital/escalated', icon: ShieldAlert, roles: ['HOSPITAL_MANAGEMENT', 'ADMIN'] },
    { label: 'User Administration', path: '/admin/users', icon: Settings, roles: ['ADMIN'] }
  ];

  const filteredItems = navItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 bg-slate-950/60 p-4 hidden md:block min-h-[calc(100vh-4rem)]">
      <div className="mb-6 px-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Navigation Menu</span>
      </div>
      <nav className="space-y-1.5">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-8 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-rose-400 font-bold mb-1">
          <Activity className="w-4 h-4" /> JeevanSetu Engine
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Pre-Transfusion T-10 advance search engine active.
        </p>
      </div>
    </aside>
  );
};
