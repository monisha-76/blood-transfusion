import React from 'react';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'rose', trend }) => {
  const colorMap = {
    rose: 'from-rose-500/20 to-rose-600/5 text-rose-400 border-rose-500/20',
    amber: 'from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20',
    sky: 'from-sky-500/20 to-sky-600/5 text-sky-400 border-sky-500/20',
    purple: 'from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20'
  };

  return (
    <div className={`p-5 rounded-2xl glass-panel bg-gradient-to-br ${colorMap[color] || colorMap.rose} border glass-card-hover relative overflow-hidden`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">{title}</p>
          <h3 className="text-3xl font-extrabold mt-1 tracking-tight text-white">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/5">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};
