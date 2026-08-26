import React from 'react';
import { FiBell, FiSearch } from 'react-icons/fi';

export const AdminHeader: React.FC = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search stores, users, or orders..." 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 pl-4">
        <button className="relative p-2 text-gray-400 hover:text-navy transition-colors">
          <FiBell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
      </div>
    </header>
  );
};
