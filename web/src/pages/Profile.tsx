import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile, useUpdateProfile } from '../hooks/useProfile';
import { SEO } from '../components/SEO';
import { Skeleton } from '../components/common/Skeleton';
import { useAuthStore } from '../store/authStore';
import { logoutUser } from '../services/auth';
import { LogOut } from 'lucide-react';

export const Profile: React.FC = () => {
  const { data: profile, isLoading } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const handleLogout = async () => {
    await logoutUser();
    setAuthenticated(false);
    navigate('/');
  };

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setPhone(profile.fullPhoneNumber || '');
      setAddress(profile.address_line1 || '');
      setCity(profile.city || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      name,
      fullPhoneNumber: phone,
      address_line1: address,
      city,
      country
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh] p-4">
        <div className="bg-white w-full max-w-[500px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
          <Skeleton width="60%" height={28} className="mx-auto mb-6" />
          <div className="flex flex-col gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton width={90} height={11} />
                <Skeleton width="100%" height={44} borderRadius={12} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh] p-4 animate-fade-in">
      <SEO title="My Profile" />
      <div className="bg-white w-full max-w-[500px] p-8 md:p-10 rounded-[24px] shadow-sm border border-gray-100">
        <h2 className="text-center mb-6 font-bold text-3xl text-body">My Profile</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-subtle uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-subtle uppercase tracking-wider">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-subtle uppercase tracking-wider">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-subtle uppercase tracking-wider">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-4 py-3 rounded-[12px] bg-gray-50 border border-gray-200 text-sm text-body focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="bg-navy text-white hover:bg-navy-mid font-bold py-3.5 rounded-[16px] text-sm transition-colors mt-4 shadow-sm disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-sale hover:bg-red-50 font-bold py-3.5 rounded-[16px] text-sm transition-colors mt-6 border-t border-gray-100 pt-6"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </div>
  );
};
