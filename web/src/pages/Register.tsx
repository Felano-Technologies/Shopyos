import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { registerUser } from '../services/auth';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await registerUser(name, email, password, phone, referral, true, true);
      setAuthenticated(true);
      
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Account Created', message: 'Signed in successfully!' }
      }));

      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[80vh] p-4">
      <div className="bg-white animate-fade-in w-full max-w-[460px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-16 h-16 object-contain rounded-2xl shadow-sm" />
        </div>
        <h2 className="text-center mb-2 font-bold text-3xl text-body">
          Create Account
        </h2>
        <p className="text-center text-subtle mb-8 text-sm">
          Join Shopyos as a Buyer today
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-[12px] mb-6 text-sm text-center font-semibold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-bold text-subtle uppercase tracking-wider">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-bold text-subtle uppercase tracking-wider">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-xs font-bold text-subtle uppercase tracking-wider">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              placeholder="+233241234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-bold text-subtle uppercase tracking-wider">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="referral" className="text-xs font-bold text-subtle uppercase tracking-wider">
              Referral Code (Optional)
            </label>
            <input
              id="referral"
              type="text"
              placeholder="Optional code"
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-navy text-white hover:bg-navy-mid font-bold py-3.5 rounded-[16px] text-sm transition-colors mt-4 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-subtle">
          Already have an account?{' '}
          <Link to="/login" className="text-navy font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
