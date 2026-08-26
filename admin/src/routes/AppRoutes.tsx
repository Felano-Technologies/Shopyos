import React, { useEffect, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { secureStorage } from '../services/storage';

const AdminLogin = React.lazy(() => import('../pages/AdminLogin').then(m => ({ default: m.AdminLogin })));
const AdminLayout = React.lazy(() => import('../components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const DashboardOverview = React.lazy(() => import('../pages/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const UserManagement = React.lazy(() => import('../pages/UserManagement').then(m => ({ default: m.UserManagement })));
const StoreManagement = React.lazy(() => import('../pages/StoreManagement').then(m => ({ default: m.StoreManagement })));
const AdminOrders = React.lazy(() => import('../pages/Orders').then(m => ({ default: m.Orders })));
const AuditLogs = React.lazy(() => import('../pages/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Settings = React.lazy(() => import('../pages/Settings').then(m => ({ default: m.Settings })));
const Categories = React.lazy(() => import('../pages/Categories').then(m => ({ default: m.Categories })));
const FlashSales = React.lazy(() => import('../pages/FlashSales').then(m => ({ default: m.FlashSales })));
const Broadcasts = React.lazy(() => import('../pages/Broadcasts').then(m => ({ default: m.Broadcasts })));
const FeeSettings = React.lazy(() => import('../pages/FeeSettings').then(m => ({ default: m.FeeSettings })));
const ListingFees = React.lazy(() => import('../pages/ListingFees').then(m => ({ default: m.ListingFees })));
const Disputes = React.lazy(() => import('../pages/Disputes').then(m => ({ default: m.Disputes })));
const Disclaimers = React.lazy(() => import('../pages/Disclaimers').then(m => ({ default: m.Disclaimers })));
const Payouts = React.lazy(() => import('../pages/Payouts').then(m => ({ default: m.Payouts })));
const Deliveries = React.lazy(() => import('../pages/Deliveries').then(m => ({ default: m.Deliveries })));
const DriverVerifications = React.lazy(() => import('../pages/DriverVerifications').then(m => ({ default: m.DriverVerifications })));
const Hubs = React.lazy(() => import('../pages/Hubs').then(m => ({ default: m.Hubs })));
const Ads = React.lazy(() => import('../pages/Ads').then(m => ({ default: m.Ads })));
const Approvals = React.lazy(() => import('../pages/Approvals').then(m => ({ default: m.Approvals })));
const Notifications = React.lazy(() => import('../pages/Notifications').then(m => ({ default: m.Notifications })));
const Revenue = React.lazy(() => import('../pages/Revenue').then(m => ({ default: m.Revenue })));
const SupportAdmin = React.lazy(() => import('../pages/Support').then(m => ({ default: m.Support })));
const NotFound = React.lazy(() => import('../pages/NotFound').then(m => ({ default: m.NotFound })));

// Guard for protected pages
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

// Guard for the login page
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
        <Route path="/login" element={<RequireGuest><AdminLogin /></RequireGuest>} />

        <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
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
