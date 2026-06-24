import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { secureStorage } from '../services/storage';

// Import actual page components
import { Home } from '../pages/Home';
import { Search } from '../pages/Search';
import { ProductDetail } from '../pages/ProductDetail';
import { Cart } from '../pages/Cart';
import { Checkout } from '../pages/Checkout';
import { Orders } from '../pages/Orders';
import { OrderTracking } from '../pages/OrderTracking';
import { Chat } from '../pages/Chat';
import { Profile } from '../pages/Profile';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/ForgotPassword';
import { ResetPassword } from '../pages/ResetPassword';

import { Layout } from '../components/layout/Layout';

// Guard for protected pages
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Layout>{children}</Layout>;
};

// Guard for login/signup pages
const RequireGuest: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  // Check auth on load
  useEffect(() => {
    const checkAuth = async () => {
      const token = await secureStorage.getItem('userToken');
      setAuthenticated(!!token);
    };
    checkAuth();
  }, [setAuthenticated]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Layout><Home /></Layout>} />
      <Route path="/search" element={<Layout><Search /></Layout>} />
      <Route path="/product/:id" element={<Layout><ProductDetail /></Layout>} />

      {/* Guest Only Pages */}
      <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
      <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />
      <Route path="/forgot-password" element={<RequireGuest><ForgotPassword /></RequireGuest>} />
      <Route path="/reset-password" element={<RequireGuest><ResetPassword /></RequireGuest>} />

      {/* Authenticated Pages */}
      <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
      <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
      <Route path="/orders/:id" element={<RequireAuth><OrderTracking /></RequireAuth>} />
      <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
