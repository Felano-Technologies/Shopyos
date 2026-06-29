import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { FiSearch, FiShoppingCart, FiUser, FiLogOut } from 'react-icons/fi';

export const Header: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const navigate = useNavigate();

  const logout = () => {
    import('../../services/auth').then((m) => m.logoutUser());
    setAuthenticated(false);
  };

  return (
    <header className="glassmorphism sticky top-0 z-50 flex justify-between items-center px-4 md:px-6 py-4 border-b border-gray-200">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold tracking-tight text-navy">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-lg" />
          SHOPYOS
        </Link>
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold" aria-label="Main navigation">
          <Link to="/" className="hover:text-lime transition-colors text-body">Marketplace</Link>
          <Link to="/search" className="hover:text-lime transition-colors text-body">Search</Link>
          {isAuthenticated && <Link to="/orders" className="hover:text-lime transition-colors text-body">My Orders</Link>}
          {isAuthenticated && <Link to="/chat" className="hover:text-lime transition-colors text-body">Chats</Link>}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <Link to="/search" className="md:hidden p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Search">
          <FiSearch size={20} />
        </Link>
        <Link to="/cart" className="relative p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Shopping cart">
          <FiShoppingCart size={20} />
        </Link>
        {isAuthenticated ? (
          <div className="hidden md:flex items-center gap-4">
            <Link to="/profile" className="p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Profile">
              <FiUser size={20} />
            </Link>
            <button onClick={logout} className="p-2 text-sale hover:bg-red-50 rounded-full transition-colors" title="Logout" aria-label="Logout">
              <FiLogOut size={20} />
            </button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="hidden md:block bg-navy text-white hover:bg-navy-mid px-5 py-2 rounded-full font-bold text-sm transition-colors" aria-label="Sign in to your account">
            Login
          </button>
        )}
      </div>
    </header>
  );
};
