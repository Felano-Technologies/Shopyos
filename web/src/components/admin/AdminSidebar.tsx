import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiHome, FiUsers, FiShoppingBag, FiTruck, FiSettings, FiFileText, FiTag, FiClock, FiSend, FiPercent, FiDollarSign, FiAlertCircle, FiCreditCard, FiMap, FiShield, FiMonitor, FiBell, FiDollarSign as FiDollar, FiMessageSquare, FiCheckCircle } from 'react-icons/fi';

export const AdminSidebar: React.FC = () => {
  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: <FiHome className="w-5 h-5" />, exact: true },
    { name: 'Users', path: '/admin/users', icon: <FiUsers className="w-5 h-5" /> },
    { name: 'Stores', path: '/admin/stores', icon: <FiShoppingBag className="w-5 h-5" /> },
    { name: 'Approvals', path: '/admin/approvals', icon: <FiCheckCircle className="w-5 h-5" /> },
    { name: 'Orders', path: '/admin/orders', icon: <FiTruck className="w-5 h-5" /> },
    { name: 'Deliveries', path: '/admin/deliveries', icon: <FiTruck className="w-5 h-5" /> },
    { name: 'Driver Verifications', path: '/admin/driver-verifications', icon: <FiShield className="w-5 h-5" /> },
    { name: 'Hubs & Transit', path: '/admin/hubs', icon: <FiMap className="w-5 h-5" /> },
    { name: 'Categories', path: '/admin/categories', icon: <FiTag className="w-5 h-5" /> },
    { name: 'Flash Sales', path: '/admin/flash-sales', icon: <FiClock className="w-5 h-5" /> },
    { name: 'Broadcasts', path: '/admin/broadcasts', icon: <FiSend className="w-5 h-5" /> },
    { name: 'Fee Settings', path: '/admin/fee-settings', icon: <FiPercent className="w-5 h-5" /> },
    { name: 'Listing Fees', path: '/admin/listing-fees', icon: <FiDollarSign className="w-5 h-5" /> },
    { name: 'Disputes', path: '/admin/disputes', icon: <FiAlertCircle className="w-5 h-5" /> },
    { name: 'Disclaimers', path: '/admin/disclaimers', icon: <FiFileText className="w-5 h-5" /> },
    { name: 'Payouts', path: '/admin/payouts', icon: <FiCreditCard className="w-5 h-5" /> },
    { name: 'Platform Ads', path: '/admin/ads', icon: <FiMonitor className="w-5 h-5" /> },
    { name: 'Revenue', path: '/admin/revenue', icon: <FiDollar className="w-5 h-5" /> },
    { name: 'Notifications', path: '/admin/notifications', icon: <FiBell className="w-5 h-5" /> },
    { name: 'Support', path: '/admin/support', icon: <FiMessageSquare className="w-5 h-5" /> },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: <FiFileText className="w-5 h-5" /> },
    { name: 'Settings', path: '/admin/settings', icon: <FiSettings className="w-5 h-5" /> },

  ];

  return (
    <aside className="w-64 bg-navy text-white h-screen flex flex-col fixed left-0 top-0 z-50">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">Shopyos Admin</h1>
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
          <div className="w-8 h-8 rounded-full bg-lime flex items-center justify-center text-lime-text font-bold text-sm">
            AD
          </div>
          <div>
            <p className="text-sm font-medium text-white">Administrator</p>
            <p className="text-xs text-white/50">admin@shopyos.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
