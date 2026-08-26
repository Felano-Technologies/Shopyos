import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiActivity, FiUser, FiClock, FiTag, FiAlertTriangle, FiSearch, FiX } from 'react-icons/fi';
import { getAdminAuditLogs } from '../services/admin';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type AuditLog = {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  metadata?: Record<string, any> | null;
  status?: 'success' | 'failure';
  failure_reason?: string | null;
  timestamp: string;
  actor: { id: string | null; email: string | null; full_name: string | null; role: string | null };
};

const PAGE_SIZE = 25;

const formatAction = (a: string) => a.replace(/_/g, ' ');
const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    getAdminAuditLogs({
      search: search || undefined,
      startDate: startDate || undefined,
      endDate: endDate ? `${endDate}T23:59:59.999` : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
      .then((res) => {
        setLogs(Array.isArray(res?.logs) ? res.logs : []);
        setTotal(res?.pagination?.total ?? 0);
      })
      .catch((err) => console.error('Failed to load audit logs', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchLogs, [search, startDate, endDate, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(search || startDate || endDate);

  return (
    <>
      <Helmet>
        <title>Audit Logs | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track administrative and system-wide activity.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[220px]">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search action, entity, or admin..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </form>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy"
            />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors">
              <FiX className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            {loading ? (
              <ListRowsSkeleton rows={8} />
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">
                {hasFilters ? 'No activity matches these filters.' : 'No activity recorded recently.'}
              </div>
            ) : (
              <div className="relative border-l border-gray-200 ml-4 space-y-8">
                {logs.map((log) => {
                  const failed = log.status === 'failure';
                  return (
                    <div key={log.id} className="relative pl-8">
                      <div className={`absolute -left-[1.35rem] top-1 w-10 h-10 rounded-full bg-white border flex items-center justify-center shadow-sm ${failed ? 'border-red-200' : 'border-gray-200'}`}>
                        {failed ? <FiAlertTriangle className="w-4 h-4 text-red-500" /> : <FiActivity className="w-4 h-4 text-navy" />}
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <FiClock className="w-3.5 h-3.5" />
                          <span>{formatDate(log.timestamp)}</span>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-gray-900 font-medium text-sm capitalize">{formatAction(log.action)}</p>
                            {failed && <span className="shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold bg-red-50 text-red-700">Failed</span>}
                          </div>
                          {failed && log.failure_reason && (
                            <p className="text-xs text-red-500 mt-1">{log.failure_reason}</p>
                          )}
                          {log.entity_type && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                              <FiTag className="w-3.5 h-3.5" />
                              <span className="capitalize">{log.entity_type}</span>
                              {log.entity_id && <span className="font-mono text-gray-400">{log.entity_id.slice(0, 8)}</span>}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 border-t border-gray-200 pt-3">
                            <FiUser className="w-3.5 h-3.5" />
                            <span>
                              {log.actor?.full_name || log.actor?.email || 'System'}
                              {log.actor?.role && <span className="text-gray-400"> · {log.actor.role}</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!loading && logs.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {totalPages} · {total.toLocaleString()} total</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
