import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAdminUsers } from '../../services/admin';
import { FiMoreVertical, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export const UserManagement: React.FC<{ filterRole?: string }> = ({ filterRole }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getAdminUsers(filterRole ? { role: filterRole } : {});
        const userList = data?.data?.users || data?.users || data?.data || data || [];
        setUsers(Array.isArray(userList) ? userList : []);
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <>
      <Helmet>
        <title>User Management | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">View and manage all registered accounts on the platform.</p>
          </div>
          <button className="bg-navy text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors">
            Add New User
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user: any, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{user.name || 'Unnamed User'}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                          {user.role || 'Buyer'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {user.isEmailVerified ? (
                            <><FiCheckCircle className="w-4 h-4 text-green-500" /><span className="text-sm text-gray-700">Verified</span></>
                          ) : (
                            <><FiXCircle className="w-4 h-4 text-red-500" /><span className="text-sm text-gray-700">Unverified</span></>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-navy transition-colors p-2">
                          <FiMoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {users.length} results</span>
            <div className="flex gap-2">
              <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" disabled>Previous</button>
              <button className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" disabled>Next</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
