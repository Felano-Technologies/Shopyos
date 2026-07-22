import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiSearch, FiShoppingBag, FiBox, FiMessageSquare, FiSettings, FiHelpCircle, FiGrid } from 'react-icons/fi';
import { useAuthStore } from '../../store/authStore';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const mainLinks = [
    { name: 'Marketplace', icon: FiHome, route: '/' },
    { name: 'Search & Explore', icon: FiSearch, route: '/search' },
    { name: 'Stores', icon: FiShoppingBag, route: '/stores' },
    { name: 'Deals & Offers', icon: FiGrid, route: '/deals' },
  ];

  const userLinks = [
    { name: 'My Orders', icon: FiBox, route: '/orders' },
    { name: 'Messages', icon: FiMessageSquare, route: '/chat' },
    { name: 'Settings', icon: FiSettings, route: '/profile' },
    { name: 'Support', icon: FiHelpCircle, route: '/support' },
  ];

  const renderLinks = (links: typeof mainLinks) => (
    <ul className="space-y-2">
      {links.map((link) => {
        const isActive = path === link.route || (link.route !== '/' && path.startsWith(link.route));
        const Icon = link.icon;
        return (
          <li key={link.name}>
            <Link
              to={link.route}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                isActive
                  ? 'bg-navy text-white shadow-md'
                  : 'text-subtle hover:bg-white hover:text-navy hover:shadow-sm'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : ''} />
              <span>{link.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-[#f8fafc] border-r border-gray-200 p-6 overflow-y-auto">
      <Link to="/" className="flex items-center gap-3 mb-10 text-2xl font-black tracking-tight text-navy">
        <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm" />
        SHOPYOS
      </Link>

      <div className="flex-1">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 ml-2">Discover</h3>
        {renderLinks(mainLinks)}

        {isAuthenticated && (
          <>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-8 mb-4 ml-2">My Account</h3>
            {renderLinks(userLinks)}
          </>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
          <p className="text-sm font-bold text-navy mb-2">Sell on Shopyos</p>
          <p className="text-xs text-subtle mb-4">Reach thousands of customers</p>
          <Link to="/business" className="w-full bg-lime text-lime-text font-bold py-2 px-4 rounded-xl hover:opacity-90 transition-opacity">
            Dashboard
          </Link>
        </div>
      </div>
    </aside>
  );
};
