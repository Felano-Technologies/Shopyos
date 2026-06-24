import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { requestPasswordResetOTP } from '../services/auth';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await requestPasswordResetOTP(email, 'email');
      setSuccess(res.message || 'OTP code sent to email successfully!');
      
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Code Sent', message: 'Please check your inbox.' }
      }));

      // Redirect to reset page after 2 seconds
      setTimeout(() => {
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP code. Please check email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[75vh] p-4">
      <div className="bg-white animate-fade-in w-full max-w-[420px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-16 h-16 object-contain rounded-2xl shadow-sm" />
        </div>
        <h2 className="text-center mb-2 font-bold text-3xl text-body">
          Forgot Password
        </h2>
        <p className="text-center text-subtle mb-8 text-sm">
          Enter your email to receive a password reset OTP
        </p>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-[12px] mb-6 text-sm text-center font-semibold border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-lime/10 text-lime p-3 rounded-[12px] mb-6 text-sm text-center font-semibold border border-lime/20">
            {success}
          </div>
        )}

        <form onSubmit={handleRequestOTP} className="flex flex-col gap-5">
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

          <button
            type="submit"
            disabled={loading}
            className="bg-navy text-white hover:bg-navy-mid font-bold py-3.5 rounded-[16px] text-sm transition-colors mt-4 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Sending code...' : 'Send OTP'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-subtle">
          Back to{' '}
          <Link to="/login" className="text-navy font-bold hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
