import React from 'react';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-body transition-colors duration-200 pb-20 md:pb-0">
      <Header />
      <main className="flex-1 w-full mx-auto w-full md:max-w-7xl p-4 md:p-8">
        {children}
      </main>
      <footer className="hidden md:block text-center py-8 border-t border-gray-200 text-subtle text-sm">
        &copy; {new Date().getFullYear()} Shopyos Marketplace. All rights reserved.
      </footer>
      <BottomNav />
    </div>
  );
};
