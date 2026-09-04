import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiShoppingBag, FiTruck, FiSettings, FiFileText, FiTag, FiClock, FiSend, FiPercent, FiAlertCircle, FiCreditCard, FiMap, FiMonitor, FiBell, FiDollarSign as FiDollar, FiMessageSquare, FiLogOut } from 'react-icons/fi';
import { logoutUser } from '../../services/auth';
import { getCachedUserProfile } from '../../services/storage';
import { useAuthStore } from '../../store/authStore';

type AdminProfile = { name?: string; email?: string; avatar_url?: string };

export const AdminSidebar: React.FC = () => {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    getCachedUserProfile().then((p) => setProfile(p as AdminProfile)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      setAuthenticated(false);
      navigate('/login');
    }
  };

  const displayName = profile?.name || 'Administrator';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'A';

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <FiHome className="w-5 h-5" />, exact: true },
    { name: 'Users', path: '/users', icon: <FiUsers className="w-5 h-5" /> },
    { name: 'Stores', path: '/stores', icon: <FiShoppingBag className="w-5 h-5" /> },
    { name: 'Orders', path: '/orders', icon: <FiTruck className="w-5 h-5" /> },
    { name: 'Deliveries', path: '/deliveries', icon: <FiTruck className="w-5 h-5" /> },
    { name: 'Riders', path: '/riders', icon: <FiTruck className="w-5 h-5" /> },
    { name: 'Hubs & Transit', path: '/hubs', icon: <FiMap className="w-5 h-5" /> },
    { name: 'Categories', path: '/categories', icon: <FiTag className="w-5 h-5" /> },
    { name: 'Flash Sales', path: '/flash-sales', icon: <FiClock className="w-5 h-5" /> },
    { name: 'Broadcasts', path: '/broadcasts', icon: <FiSend className="w-5 h-5" /> },
    { name: 'Fee Settings', path: '/fee-settings', icon: <FiPercent className="w-5 h-5" /> },
    { name: 'Disputes', path: '/disputes', icon: <FiAlertCircle className="w-5 h-5" /> },
    { name: 'Disclaimers', path: '/disclaimers', icon: <FiFileText className="w-5 h-5" /> },
    { name: 'Payouts', path: '/payouts', icon: <FiCreditCard className="w-5 h-5" /> },
    { name: 'Platform Ads', path: '/ads', icon: <FiMonitor className="w-5 h-5" /> },
    { name: 'Revenue', path: '/revenue', icon: <FiDollar className="w-5 h-5" /> },
    { name: 'Notifications', path: '/notifications', icon: <FiBell className="w-5 h-5" /> },
    { name: 'Support', path: '/support', icon: <FiMessageSquare className="w-5 h-5" /> },
    { name: 'Audit Logs', path: '/audit-logs', icon: <FiFileText className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <FiSettings className="w-5 h-5" /> },

  ];

  return (
    <aside className="w-64 bg-navy dark:bg-[#050814] text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10 shrink-0">
        <img src="/iconwhite.png" alt="Shopyos" className="w-8 h-8 object-contain shrink-0" />
        <h1 className="text-lg font-bold tracking-tight truncate">Shopyos Admin</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 sidebar-scroll">
        <nav className="flex flex-col gap-1 px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-white/15 text-white' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-lime flex items-center justify-center text-lime-text font-bold text-sm shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{displayName}</p>
            <p className="text-xs text-white/50 truncate">{profile?.email || 'admin@shopyos.com'}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Log out"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <FiLogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
