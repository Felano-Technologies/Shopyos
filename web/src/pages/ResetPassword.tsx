import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyPasswordResetOTP, resetPasswordWithToken } from '../services/auth';
import { SEO } from '../components/SEO';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Verify OTP to get reset token
      const verifyRes = await verifyPasswordResetOTP(email, code);
      const resetToken = verifyRes.resetToken;

      if (!resetToken) {
        throw new Error('Failed to retrieve reset token. Verify code.');
      }

      // 2. Reset password
      await resetPasswordWithToken(resetToken, password);
      setSuccess('Password updated successfully! Redirecting to login...');
      
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', title: 'Reset Successful', message: 'You can now log in.' }
      }));

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Verification or password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[75vh] p-4">
      <SEO title="Reset Password" />
      <div className="bg-white animate-fade-in w-full max-w-[420px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-16 h-16 object-contain rounded-2xl shadow-sm" />
        </div>
        <h2 className="text-center mb-2 font-bold text-3xl text-body">
          Reset Password
        </h2>
        <p className="text-center text-subtle mb-8 text-sm">
          Enter the OTP code sent to <strong className="font-bold text-navy">{email}</strong>
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

        <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-xs font-bold text-subtle uppercase tracking-wider">
              OTP Code
            </label>
            <input
              id="code"
              type="text"
              placeholder="Enter 6-digit OTP"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all text-center font-mono tracking-widest text-lg"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-bold text-subtle uppercase tracking-wider">
              New Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter new password"
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
          >
            {loading ? 'Verifying and saving...' : 'Reset Password'}
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
