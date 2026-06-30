import React, { useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { secureStorage } from '../services/storage';

import { Layout } from '../components/layout/Layout';

const Home = React.lazy(() => import('../pages/Home').then(m => ({ default: m.Home })));
const Search = React.lazy(() => import('../pages/Search').then(m => ({ default: m.Search })));
const ProductDetail = React.lazy(() => import('../pages/ProductDetail').then(m => ({ default: m.ProductDetail })));
const Cart = React.lazy(() => import('../pages/Cart').then(m => ({ default: m.Cart })));
const Checkout = React.lazy(() => import('../pages/Checkout').then(m => ({ default: m.Checkout })));
const Orders = React.lazy(() => import('../pages/Orders').then(m => ({ default: m.Orders })));
const OrderTracking = React.lazy(() => import('../pages/OrderTracking').then(m => ({ default: m.OrderTracking })));
const Chat = React.lazy(() => import('../pages/Chat').then(m => ({ default: m.Chat })));
const Profile = React.lazy(() => import('../pages/Profile').then(m => ({ default: m.Profile })));
const Login = React.lazy(() => import('../pages/Login').then(m => ({ default: m.Login })));
const Register = React.lazy(() => import('../pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = React.lazy(() => import('../pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = React.lazy(() => import('../pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const NotFound = React.lazy(() => import('../pages/NotFound').then(m => ({ default: m.NotFound })));

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

const LoadingFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
  </div>
);

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
    <Suspense fallback={<LoadingFallback />}>
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

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};
