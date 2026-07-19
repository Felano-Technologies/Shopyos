import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiUsers, FiShoppingBag, FiTruck, FiDollarSign } from 'react-icons/fi';
import { getAdminDashboard } from '../../services/admin';

export const DashboardOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await getAdminDashboard();
        setStats(data);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const kpis = [
    { label: 'Total Users', value: stats?.users?.total || '0', icon: <FiUsers className="w-6 h-6" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Stores', value: stats?.stores?.active || '0', icon: <FiShoppingBag className="w-6 h-6" />, color: 'bg-green-50 text-green-600' },
    { label: 'Active Orders', value: stats?.orders?.active || '0', icon: <FiTruck className="w-6 h-6" />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Platform Revenue', value: '$' + (stats?.revenue?.total || '0'), icon: <FiDollarSign className="w-6 h-6" />, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Shopyos</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time metrics and platform activity</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`p-4 rounded-xl ${kpi.color}`}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {loading ? '...' : kpi.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
          {/* Recent Activity Placeholder */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Audit Logs</h2>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-10 bg-gray-100 rounded-lg w-full"></div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No recent activity found.
              </div>
            )}
          </div>

          {/* Quick Actions Placeholder */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Pending Approvals</h2>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-gray-100 rounded-lg w-full"></div>
                <div className="h-16 bg-gray-100 rounded-lg w-full"></div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                All caught up! No pending stores or drivers.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
