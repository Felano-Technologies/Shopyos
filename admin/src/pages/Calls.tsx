import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiPhone, FiPhoneMissed, FiPlay, FiX } from 'react-icons/fi';
import { getAdminCalls } from '../services/admin';
import { ListRowsSkeleton } from '../components/common/ListRowsSkeleton';

type CallParty = { id: string; email: string | null; user_profiles?: { full_name?: string } | { full_name?: string }[] | null };

type Call = {
  id: string;
  order_id: string | null;
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  end_reason: string | null;
  recording_status: 'pending' | 'available' | 'failed' | 'not_recorded';
  recording_url: string | null;
  created_at: string;
  caller: CallParty;
  receiver: CallParty;
  order: { id: string; order_number: string } | null;
};

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Ended', value: 'ended' },
  { label: 'Missed', value: 'missed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Ringing', value: 'ringing' },
];

const STATUS_STYLES: Record<string, string> = {
  ended: 'bg-green-50 text-green-700',
  missed: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  ringing: 'bg-blue-50 text-blue-700',
  accepted: 'bg-blue-50 text-blue-700',
  failed: 'bg-red-50 text-red-700',
};

const partyName = (p?: CallParty | null) => {
  const profile = Array.isArray(p?.user_profiles) ? p?.user_profiles[0] : p?.user_profiles;
  return profile?.full_name || p?.email?.split('@')[0] || 'Unknown';
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDate = (v: string) => new Date(v).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const Calls: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [playing, setPlaying] = useState<Call | null>(null);

  useEffect(() => {
    setLoading(true);
    getAdminCalls({ status: status || undefined, limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE })
      .then((res) => {
        const rows: Call[] = Array.isArray(res?.data) ? res.data : [];
        setHasMore(rows.length > PAGE_SIZE);
        setCalls(rows.slice(0, PAGE_SIZE));
      })
      .catch((err) => console.error('Failed to load calls', err))
      .finally(() => setLoading(false));
  }, [status, page]);

  return (
    <>
      <Helmet>
        <title>Calls | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-body">In-App Calls</h1>
          <p className="text-sm text-secondary mt-1">Every in-app call between buyers, sellers, drivers, and admins — recorded for audit and dispute resolution.</p>
        </div>

        <div className="flex gap-1 bg-surface-muted rounded-lg p-1 w-fit">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${status === f.value ? 'bg-card text-navy shadow-sm' : 'text-secondary hover:text-body'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {loading ? (
            <ListRowsSkeleton rows={8} />
          ) : calls.length === 0 ? (
            <div className="p-12 text-center text-sm text-secondary">No calls match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-muted/50 border-b border-border">
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Caller</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Receiver</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Order</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">Recording</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {calls.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-body">{partyName(c.caller)}</td>
                      <td className="px-6 py-3 text-sm text-body">{partyName(c.receiver)}</td>
                      <td className="px-6 py-3 text-sm text-secondary">{c.order?.order_number || '—'}</td>
                      <td className="px-6 py-3 text-sm text-body">{formatDuration(c.duration_seconds)}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_STYLES[c.status] || 'bg-surface-muted text-secondary'}`}>
                          {c.status === 'missed' || c.status === 'rejected' ? <FiPhoneMissed className="w-3 h-3" /> : <FiPhone className="w-3 h-3" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-secondary">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-3">
                        {c.recording_status === 'available' && c.recording_url ? (
                          <button
                            onClick={() => setPlaying(c)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy/10 text-navy text-xs font-semibold hover:bg-navy/15 transition-colors"
                          >
                            <FiPlay className="w-3 h-3" /> Play
                          </button>
                        ) : (
                          <span className="text-xs text-subtle capitalize">{c.recording_status.replace('_', ' ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && calls.length > 0 && (
            <div className="px-6 py-4 border-t border-border bg-surface-muted/30 flex items-center justify-between text-sm text-secondary">
              <span>Page {page}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="px-3 py-1 border border-border rounded-lg hover:bg-surface-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {playing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div className="bg-card rounded-xl shadow-lg border border-border p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-body">{partyName(playing.caller)} → {partyName(playing.receiver)}</h2>
                <p className="text-xs text-secondary mt-0.5">{formatDate(playing.created_at)} · {formatDuration(playing.duration_seconds)}</p>
              </div>
              <button onClick={() => setPlaying(null)} className="p-1.5 rounded-lg hover:bg-surface-muted transition-colors">
                <FiX className="w-4 h-4 text-secondary" />
              </button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls autoPlay src={playing.recording_url || undefined} className="w-full" />
          </div>
        </div>
      )}
    </>
  );
};
