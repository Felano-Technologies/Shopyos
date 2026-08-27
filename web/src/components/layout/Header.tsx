import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Search, ShoppingCart, User, LogOut, MessageCircle } from 'lucide-react';

const NAV_LINKS = [
  { name: 'Marketplace', route: '/' },
  { name: 'Stores', route: '/stores' },
  { name: 'Deals', route: '/deals' },
  { name: 'My Orders', route: '/orders', authOnly: true },
];

export const Header: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const logout = () => {
    import('../../services/auth').then((m) => m.logoutUser());
    setAuthenticated(false);
  };

  return (
    <header className="glassmorphism sticky top-0 z-50 flex justify-between items-center gap-6 px-4 md:px-6 py-4 border-b border-gray-200">
      <div className="flex items-center gap-8 min-w-0">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-navy shrink-0">
          <img src="/adaptive-icon.png" alt="Shopyos Logo" className="w-8 h-8 object-contain rounded-lg" />
          <span className="hidden sm:inline">SHOPYOS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
          {NAV_LINKS.filter((l) => !l.authOnly || isAuthenticated).map((link) => {
            const isActive = path === link.route || (link.route !== '/' && path.startsWith(link.route));
            return (
              <Link
                key={link.route}
                to={link.route}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive ? 'bg-navy text-white' : 'text-body hover:bg-gray-100'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
        <Link to="/search" className="p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Search">
          <Search size={20} />
        </Link>

        {isAuthenticated && (
          <Link to="/chat" className="p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Messages">
            <MessageCircle size={20} />
          </Link>
        )}

        <Link to="/cart" className="relative p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Shopping cart">
          <ShoppingCart size={20} />
        </Link>

        <Link
          to={isAuthenticated ? '/business' : '/register'}
          className="hidden lg:block bg-lime text-lime-text font-bold px-4 py-2 rounded-md text-sm hover:opacity-90 transition-opacity"
        >
          Sell on Shopyos
        </Link>

        {isAuthenticated ? (
          <div className="hidden md:flex items-center gap-2">
            <Link to="/profile" className="p-2 text-navy hover:bg-gray-100 rounded-full transition-colors" aria-label="Profile">
              <User size={20} />
            </Link>
            <button onClick={logout} className="p-2 text-sale hover:bg-red-50 rounded-full transition-colors" title="Logout" aria-label="Logout">
              <LogOut size={20} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="bg-navy text-white hover:bg-navy-mid px-3 sm:px-5 py-2 rounded-full font-bold text-sm transition-colors"
            aria-label="Sign in to your account"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
};
