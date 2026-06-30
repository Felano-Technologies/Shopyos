import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { loginUser } from '../services/auth';
import { SEO } from '../components/SEO';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Get browser location coordinates
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
      await loginUser(email, password, lat, lng);
      setAuthenticated(true);
      
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Welcome Back', message: `Signed in successfully as ${email}` }
      }));

      // Redirect to home page
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[75vh] p-4">
      <SEO title="Sign In" />
      <div className="bg-white animate-fade-in w-full max-w-[420px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-16 h-16 object-contain rounded-2xl shadow-sm" />
        </div>
        <h2 className="text-center mb-2 font-bold text-3xl text-body">
          Welcome Back
        </h2>
        <p className="text-center text-subtle mb-8 text-sm">
          Sign in to your Shopyos Buyer account
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-[12px] mb-6 text-sm text-center font-semibold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
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
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-xs font-bold text-subtle uppercase tracking-wider">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-navy font-semibold hover:underline">
                Forgot Password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-navy text-white hover:bg-navy-mid font-bold py-3.5 rounded-[16px] text-sm transition-colors mt-4 shadow-sm disabled:opacity-50"
            aria-label="Sign in to your account"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-subtle">
          New to Shopyos?{' '}
          <Link to="/register" className="text-navy font-bold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
