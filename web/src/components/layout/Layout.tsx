import React from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-body transition-colors duration-200 pb-[80px] md:pb-0">
      <Header />
      <main className="flex-1 w-full px-4 py-4 sm:px-6 md:px-8 md:py-8">
        {children}
      </main>
      <footer className="hidden md:block text-center py-8 mt-auto border-t border-gray-200 text-subtle text-sm">
        &copy; {new Date().getFullYear()} Shopyos Marketplace. All rights reserved.
      </footer>
      <BottomNav />
    </div>
  );
};
