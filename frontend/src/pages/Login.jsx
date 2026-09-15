import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Droplet, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await login({ email, password });
      if (res.success) {
        toast.success(`Welcome back, ${res.data.user.name}!`);
const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');
        navigate(redirect || '/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <Droplet className="w-6 h-6 fill-rose-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">Sign In to JeevanSetu</h2>
          <p className="text-xs text-slate-400">Access your role-based blood management dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@jeevansetu.org"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Quick Fill Buttons */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Quick Demo Account Fill:</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => quickFill('patient@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              👤 Patient
            </button>
            <button
              onClick={() => quickFill('doctor@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              🩺 Doctor
            </button>
            <button
              onClick={() => quickFill('donor@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              🩸 Donor
            </button>
            <button
              onClick={() => quickFill('bloodbank@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              🏦 Blood Bank
            </button>
            <button
              onClick={() => quickFill('hospital@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              🏥 Hospital Mgmt
            </button>
            <button
              onClick={() => quickFill('admin@jeevansetu.org', 'password123')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 text-left transition truncate"
            >
              ⚙️ Admin
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-rose-400 font-bold hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
