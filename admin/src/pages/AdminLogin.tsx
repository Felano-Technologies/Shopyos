import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { loginUser } from '../services/auth';
import { SEO } from '../components/SEO';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiBarChart2, FiUsers, FiShield, FiTruck } from 'react-icons/fi';

const DEV_ACCOUNTS = [
  { label: 'Admin', email: 'shoyosecommercehub@gmail.com', password: 'Shopyos@2026' },
];

const FEATURES = [
  { icon: FiBarChart2, text: 'Real-time platform analytics' },
  { icon: FiUsers, text: 'Full user & seller management' },
  { icon: FiShield, text: 'Audit logs & security controls' },
  { icon: FiTruck, text: 'Driver & delivery oversight' },
];

export const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const handleLogin = async (e?: React.FormEvent, devEmail?: string, devPassword?: string) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const loginEmail = devEmail || email;
    const loginPassword = devPassword || password;

    let lat = 0;
    let lng = 0;
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (err) {
        console.warn('Geolocation failed or denied, using defaults.', err);
      }
    }

    try {
      const response = await loginUser(loginEmail, loginPassword, lat, lng);
      
      const roleStr = String(response?.role ?? response?.account_type ?? '').toLowerCase();
      const rolesArr = Array.isArray(response?.roles) ? response.roles : [];
      const isAdmin = roleStr === 'admin' || rolesArr.some((item: any) => {
        if (typeof item === 'string') return item.toLowerCase() === 'admin';
        return String(item?.name ?? item?.role ?? '').toLowerCase() === 'admin';
      });

      if (!isAdmin) {
        throw new Error('This portal is restricted to admin accounts.');
      }

      setAuthenticated(true);
      
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Welcome back', message: `Signing you into the admin portal…` }
      }));

      // Redirect to admin dashboard
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50/50 p-4 font-sans">
      <SEO title="Admin Portal Login" />
      
      <div className="flex flex-col md:flex-row w-full max-w-[1000px] min-h-[600px] bg-white rounded-3xl shadow-xl shadow-navy/5 border border-gray-100 overflow-hidden">
        
        {/* Left Branding Panel */}
        <div className="hidden md:flex flex-col bg-gradient-to-br from-[#01217B] via-[#0C3494] to-[#0A5CA8] w-5/12 p-8 md:p-10 text-white relative overflow-hidden justify-between">
          <div className="absolute -top-24 -right-16 w-[340px] h-[340px] rounded-full bg-white opacity-[0.06]"></div>
          <div className="absolute bottom-16 -left-16 w-[220px] h-[220px] rounded-full bg-white opacity-[0.08]"></div>
          
          <div className="relative z-10 flex-1 flex flex-col justify-center">
            <img src="/iconwhite.png" alt="Shopyos Admin" className="w-20 h-20 object-contain mb-6" />
            
            <h1 className="text-[40px] font-bold leading-[48px] mb-2 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              Welcome to<br/>Shopyos Admin Portal
            </h1>
            <p className="text-white/80 text-[16px] leading-[24px] mb-6 pr-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Manage your platform, people, and operations from one powerful hub.
            </p>

            <div className="flex flex-col gap-4">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-4 h-4 text-[#85CC16]" />
                  </div>
                  <span className="text-[15px] text-white/90 font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 mt-8 opacity-80">
            <div className="w-1.5 h-1.5 rounded-full bg-[#85CC16]"></div>
            <span className="text-xs font-semibold tracking-wider uppercase">Shopyos © 2026</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center w-full md:w-7/12 p-8 md:p-10">
          <div className="flex justify-center mb-6 md:hidden">
            <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-24 h-24 object-contain rounded-2xl shadow-sm" />
          </div>
          
          <h2 className="font-bold text-[32px] text-[#0F172A] mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Sign in</h2>
          <p className="text-[#64748B] mb-6 text-[16px] font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
            Admin access only
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 text-sm font-medium border border-red-100 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-[#334155]">
                Email address
              </label>
              <div className="relative flex items-center">
                <FiMail className="absolute left-4 w-[18px] h-[18px] text-[#64748B]" />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@shopyos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#01217B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01217B] transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-[#334155]">
                Password
              </label>
              <div className="relative flex items-center">
                <FiLock className="absolute left-4 w-[18px] h-[18px] text-[#64748B]" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-12 py-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[16px] text-[#0F172A] placeholder-[#94A3B8] focus:border-[#01217B] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01217B] transition-all"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 p-1 text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  {showPw ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-start mt-1">
              <Link to="/forgot-password" className="text-sm font-semibold text-[#01217B] hover:text-[#0C3494] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex justify-between items-center bg-gradient-to-r from-[#01217B] to-[#1e3a8a] text-white font-semibold py-4 px-6 rounded-xl text-[15px] transition-all mt-4 hover:shadow-lg hover:shadow-navy/20 disabled:opacity-70 disabled:hover:shadow-none"
            >
              {loading ? (
                <span className="w-full text-center">Authenticating...</span>
              ) : (
                <>
                  <span>Sign in to Admin Portal</span>
                  <FiArrowRight className="w-5 h-5 text-[#85CC16] group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-[#E2E8F0]"></div>
              <span className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider">Dev quick-login</span>
              <div className="flex-1 h-px bg-[#E2E8F0]"></div>
            </div>
            
            <div className="flex flex-col gap-2">
              {DEV_ACCOUNTS.map((acc) => (
                <button
                  key={acc.label}
                  disabled={loading}
                  onClick={(e) => handleLogin(e, acc.email, acc.password)}
                  className="py-3 px-4 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all disabled:opacity-50"
                >
                  Log in as {acc.label}
                </button>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};
