import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  FiUsers, FiCheckCircle, FiUser, FiShoppingBag, FiTruck, FiBox, FiX, FiUserPlus, FiSearch, FiTrash2,
} from 'react-icons/fi';
import { getAdminUsers, getAdminUserStats, adminUpdateUserStatus, adminDeleteUser, adminUpdateUserRole, createAdminUser } from '../services/admin';
import { extractErrorMessage } from '../services/client';
import { TableRowsSkeleton } from '../components/common/TableRowsSkeleton';

type UserStats = {
  total: number;
  active: number;
  buyers: number;
  sellers: number;
  drivers: number;
  parcel_partners: number;
};

const ROLE_TABS: { label: string; value: string | null; icon: React.ReactNode; color: string; accent: string }[] = [
  { label: 'All', value: null, icon: <FiUsers className="w-4 h-4" />, color: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
  { label: 'Buyers', value: 'buyer', icon: <FiUser className="w-4 h-4" />, color: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
  { label: 'Sellers', value: 'seller', icon: <FiShoppingBag className="w-4 h-4" />, color: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
  { label: 'Riders', value: 'driver', icon: <FiTruck className="w-4 h-4" />, color: 'bg-navy/10 text-navy', accent: 'bg-navy' },
  { label: 'Parcel Partners', value: 'parcel_partner', icon: <FiBox className="w-4 h-4" />, color: 'bg-cyan-50 text-cyan-600', accent: 'bg-cyan-500' },
];

const ROLE_OPTIONS = ['buyer', 'seller', 'driver', 'parcel_partner', 'admin'] as const;

const PAGE_SIZE = 20;

const emptyCreateForm = { full_name: '', email: '', phone: '', password: '', role: 'buyer' };

const Avatar: React.FC<{ url?: string; name?: string; email?: string }> = ({ url, name, email }) => {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return <img src={url} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />;
  }
  return <>{name?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || 'U'}</>;
};

export const UserManagement: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    getAdminUserStats()
      .then((res) => { if (res?.stats) setStats(res.stats); })
      .catch((err) => console.error('Failed to load user stats', err));
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    const params: any = { limit: PAGE_SIZE, offset };
    if (roleFilter) params.role = roleFilter;
    if (search) params.search = search;
    getAdminUsers(params)
      .then((res) => setUsers(Array.isArray(res?.users) ? res.users : []))
      .catch((err) => console.error('Failed to load users', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchUsers, [roleFilter, search, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const handleDelete = async (user: any) => {
    if (!window.confirm(`Permanently delete ${user.full_name || user.email}? This will deactivate their account and cannot be undone from here.`)) {
      return;
    }
    setBusyUserId(user.id);
    try {
      await adminDeleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      getAdminUserStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
    } catch (err) {
      console.error('Failed to delete user', err);
      window.alert(extractErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleActive = async (user: any) => {
    const newStatus = user.account_status === 'active' ? 'suspended' : 'active';
    setBusyUserId(user.id);
    try {
      await adminUpdateUserStatus(user.id, newStatus);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, account_status: newStatus } : u)));
    } catch (err) {
      console.error('Failed to update user status', err);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleRoleChange = async (user: any, newRole: string) => {
    if (newRole === user.role) return;
    if (!window.confirm(`Change ${user.full_name || user.email}'s role from ${user.role || 'buyer'} to ${newRole}?`)) {
      return;
    }
    setBusyUserId(user.id);
    try {
      await adminUpdateUserRole(user.id, newRole as any);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      getAdminUserStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
    } catch (err) {
      console.error('Failed to update user role', err);
      window.alert(extractErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createAdminUser(createForm);
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      setOffset(0);
      fetchUsers();
      getAdminUserStats().then((res) => { if (res?.stats) setStats(res.stats); }).catch(() => {});
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total, icon: <FiUsers className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-600', accent: 'bg-blue-500' },
    { label: 'Active', value: stats.active, icon: <FiCheckCircle className="w-4 h-4" />, iconBg: 'bg-green-50 text-green-600', accent: 'bg-green-500' },
    { label: 'Buyers', value: stats.buyers, icon: <FiUser className="w-4 h-4" />, iconBg: 'bg-purple-50 text-purple-600', accent: 'bg-purple-500' },
    { label: 'Sellers', value: stats.sellers, icon: <FiShoppingBag className="w-4 h-4" />, iconBg: 'bg-amber-50 text-amber-600', accent: 'bg-amber-500' },
    { label: 'Riders', value: stats.drivers, icon: <FiTruck className="w-4 h-4" />, iconBg: 'bg-navy/10 text-navy', accent: 'bg-navy' },
    { label: 'Parcel Partners', value: stats.parcel_partners, icon: <FiBox className="w-4 h-4" />, iconBg: 'bg-cyan-50 text-cyan-600', accent: 'bg-cyan-500' },
  ] : [];

  return (
    <>
      <Helmet>
        <title>User Management | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-body">User Management</h1>
            <p className="text-sm text-secondary mt-1">Buyers, sellers, drivers and parcel partners on the platform.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-navy text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors"
          >
            <FiUserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {(stats ? statCards : Array.from({ length: 6 })).map((card: any, idx) => (
            <div key={card?.label || idx} className="relative bg-card p-4 rounded-xl shadow-sm border border-border overflow-hidden">
              {card ? (
                <>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.iconBg}`}>{card.icon}</div>
                  <p className="text-xl font-bold text-body">{card.value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-secondary mt-1">{card.label}</p>
                  <span className={`absolute bottom-0 left-0 right-0 h-[3px] ${card.accent}`} />
                </>
              ) : (
                <div className="animate-pulse bg-surface-muted rounded-lg h-16" />
              )}
            </div>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
          />
        </form>

        {/* Role tabs */}
        <div className="flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => { setRoleFilter(tab.value); setOffset(0); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                roleFilter === tab.value
                  ? 'bg-navy text-white border-navy'
                  : 'bg-card text-secondary border-border hover:border-navy/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-muted/50 border-b border-border">
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-xs font-semibold text-secondary uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <TableRowsSkeleton columns={5} leadingIcon />
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-secondary">No users found.</td>
                  </tr>
                ) : (
                  users.map((user: any) => (
                    <tr key={user.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center font-bold text-secondary text-sm overflow-hidden shrink-0">
                            <Avatar url={user.avatar_url} name={user.full_name} email={user.email} />
                          </div>
                          <div>
                            <div className="font-semibold text-body">{user.full_name || 'Unnamed User'}</div>
                            <div className="text-sm text-secondary">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role || 'buyer'}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          disabled={busyUserId === user.id}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 capitalize border-0 focus:outline-none focus:ring-1 focus:ring-navy disabled:opacity-50 cursor-pointer"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r} className="bg-card text-body">{r.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                          user.account_status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {user.account_status === 'active' ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleActive(user)}
                            disabled={busyUserId === user.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                              user.account_status === 'active'
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-green-200 text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {busyUserId === user.id ? '...' : user.account_status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={busyUserId === user.id}
                            title="Delete user"
                            className="p-1.5 rounded-lg border border-border text-subtle hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
            <span>Showing {users.length} result{users.length === 1 ? '' : 's'}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={users.length < PAGE_SIZE}
                className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-body">Add New User</h2>
              <button onClick={() => setShowCreate(false)} className="text-subtle hover:text-secondary">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                required
                placeholder="Full name"
                value={createForm.full_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy"
              />
              <input
                placeholder="Phone (optional)"
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy"
              />
              <input
                required
                type="password"
                placeholder="Temporary password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy"
              />
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-border text-sm focus:outline-none focus:ring-1 focus:ring-navy focus:border-navy"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="driver">Driver</option>
                <option value="parcel_partner">Parcel Partner</option>
                <option value="admin">Admin</option>
              </select>

              <button
                type="submit"
                disabled={creating}
                className="mt-2 bg-navy text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
