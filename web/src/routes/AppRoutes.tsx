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
const Deals = React.lazy(() => import('../pages/Deals').then(m => ({ default: m.Deals })));
const Stores = React.lazy(() => import('../pages/Stores').then(m => ({ default: m.Stores })));
const Support = React.lazy(() => import('../pages/Support').then(m => ({ default: m.Support })));
const DriverDashboard = React.lazy(() => import('../pages/DriverDashboard').then(m => ({ default: m.DriverDashboard })));
const NotFound = React.lazy(() => import('../pages/NotFound').then(m => ({ default: m.NotFound })));

// Admin Pages
const AdminLogin = React.lazy(() => import('../pages/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminLayout = React.lazy(() => import('../components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const DashboardOverview = React.lazy(() => import('../pages/admin/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const UserManagement = React.lazy(() => import('../pages/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const StoreManagement = React.lazy(() => import('../pages/admin/StoreManagement').then(m => ({ default: m.StoreManagement })));
const AdminOrders = React.lazy(() => import('../pages/admin/Orders').then(m => ({ default: m.Orders })));
const AuditLogs = React.lazy(() => import('../pages/admin/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Settings = React.lazy(() => import('../pages/admin/Settings').then(m => ({ default: m.Settings })));
const Categories = React.lazy(() => import('../pages/admin/Categories').then(m => ({ default: m.Categories })));
const FlashSales = React.lazy(() => import('../pages/admin/FlashSales').then(m => ({ default: m.FlashSales })));
const Broadcasts = React.lazy(() => import('../pages/admin/Broadcasts').then(m => ({ default: m.Broadcasts })));
const FeeSettings = React.lazy(() => import('../pages/admin/FeeSettings').then(m => ({ default: m.FeeSettings })));
const ListingFees = React.lazy(() => import('../pages/admin/ListingFees').then(m => ({ default: m.ListingFees })));
const Disputes = React.lazy(() => import('../pages/admin/Disputes').then(m => ({ default: m.Disputes })));
const Disclaimers = React.lazy(() => import('../pages/admin/Disclaimers').then(m => ({ default: m.Disclaimers })));
const Payouts = React.lazy(() => import('../pages/admin/Payouts').then(m => ({ default: m.Payouts })));
const Deliveries = React.lazy(() => import('../pages/admin/Deliveries').then(m => ({ default: m.Deliveries })));
const DriverVerifications = React.lazy(() => import('../pages/admin/DriverVerifications').then(m => ({ default: m.DriverVerifications })));
const Hubs = React.lazy(() => import('../pages/admin/Hubs').then(m => ({ default: m.Hubs })));
const Ads = React.lazy(() => import('../pages/admin/Ads').then(m => ({ default: m.Ads })));
const Approvals = React.lazy(() => import('../pages/admin/Approvals').then(m => ({ default: m.Approvals })));
const Notifications = React.lazy(() => import('../pages/admin/Notifications').then(m => ({ default: m.Notifications })));
const Revenue = React.lazy(() => import('../pages/admin/Revenue').then(m => ({ default: m.Revenue })));
const SupportAdmin = React.lazy(() => import('../pages/admin/Support').then(m => ({ default: m.Support })));

// Guard for protected pages
const RequireAuth: React.FC<{ children: React.ReactNode; withLayout?: boolean }> = ({ children, withLayout = true }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return withLayout ? <Layout>{children}</Layout> : <>{children}</>;
};

// Guard for login/signup pages
const RequireGuest: React.FC<{ children: React.ReactNode; redirectTo?: string }> = ({ children, redirectTo = '/' }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
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
        <Route path="/deals" element={<Layout><Deals /></Layout>} />
        <Route path="/stores" element={<Layout><Stores /></Layout>} />
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
        <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
        <Route path="/driver" element={<RequireAuth><DriverDashboard /></RequireAuth>} />

        {/* Admin Pages */}
        <Route path="/admin-login" element={<RequireGuest redirectTo="/admin"><AdminLogin /></RequireGuest>} />
        
        <Route path="/admin" element={<RequireAuth withLayout={false}><AdminLayout /></RequireAuth>}>
          <Route index element={<DashboardOverview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="stores" element={<StoreManagement />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="categories" element={<Categories />} />
          <Route path="flash-sales" element={<FlashSales />} />
          <Route path="broadcasts" element={<Broadcasts />} />
          <Route path="fee-settings" element={<FeeSettings />} />
          <Route path="listing-fees" element={<ListingFees />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="disclaimers" element={<Disclaimers />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="driver-verifications" element={<DriverVerifications />} />
          <Route path="hubs" element={<Hubs />} />
          <Route path="ads" element={<Ads />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="support" element={<SupportAdmin />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};
