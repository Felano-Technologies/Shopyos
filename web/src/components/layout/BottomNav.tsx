import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiSearch, FiShoppingBag, FiSettings, FiBox } from 'react-icons/fi';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { name: 'Home', icon: FiHome, route: '/' },
    { name: 'Search', icon: FiSearch, route: '/search' },
    { name: 'Stores', icon: FiShoppingBag, route: '/stores' },
    { name: 'Orders', icon: FiBox, route: '/orders' },
    { name: 'Settings', icon: FiSettings, route: '/profile' },
  ];

  return (
    <div className="md:hidden fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="flex flex-row bg-white w-[90%] h-[60px] rounded-[30px] px-2 items-center justify-center border border-gray-100 shadow-[0_6px_15px_rgba(0,0,0,0.1)] pointer-events-auto overflow-hidden relative">
        {navItems.map((item) => {
          const isActive = path === item.route || (item.route !== '/' && path.startsWith(item.route));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.route}
              className={`relative flex items-center justify-center h-12 transition-all duration-300 rounded-full ${
                isActive ? 'flex-[2.8] mx-1 bg-gradient-to-r from-navy to-navy-mid' : 'flex-1'
              }`}
            >
              <div className="flex flex-row items-center justify-center px-3">
                <Icon size={isActive ? 20 : 22} color={isActive ? '#FFF' : '#94A3B8'} />
                {isActive && (
                  <span className="text-white text-xs font-bold ml-2 truncate">
                    {item.name}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
