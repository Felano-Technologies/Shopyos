import React, { useState, useEffect } from 'react';
import { FiMessageSquare, FiXCircle } from 'react-icons/fi';
import { api } from '../services/client';

export const Support: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/support/tickets', { params: { status: activeTab } });
      if (res.data?.success || res.data) setTickets(res.data?.data || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [activeTab]);

  const handleReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`/admin/support/tickets/${selectedTicket.id}/reply`, { message: replyText });
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Reply sent' } }));
      setReplyText('');
      setSelectedTicket(null);
      fetchTickets();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await api.put(`/admin/support/tickets/${id}/close`);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Ticket closed' } }));
      fetchTickets();
      if (selectedTicket?.id === id) setSelectedTicket(null);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Support Tickets</h1>
        <p className="text-sm text-slate-500">Manage user inquiries and support requests</p>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 mb-6">
        {[
          { id: 'open', label: 'Open Tickets' },
          { id: 'closed', label: 'Closed Tickets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 text-sm font-semibold transition-colors relative ${
              activeTab === tab.id ? 'text-navy' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiMessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No {activeTab} tickets found</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Subject</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{t.user?.full_name || 'N/A'}</p>
                    <p className="text-sm text-slate-500">{t.user?.email || 'N/A'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{t.subject}</p>
                    <p className="text-sm text-slate-500 max-w-xs truncate">{t.last_message}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="text-navy hover:text-navy-mid text-sm font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Support Ticket</h2>
              <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600"><FiXCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-sm font-semibold text-slate-900 mb-1">Subject: {selectedTicket.subject}</p>
                <p className="text-sm text-slate-500">{selectedTicket.last_message}</p>
              </div>

              {activeTab === 'open' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Reply to User</label>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy resize-none"
                    placeholder="Type your response..."
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              {activeTab === 'open' ? (
                <>
                  <button
                    onClick={() => handleClose(selectedTicket.id)}
                    className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Close Ticket
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={submitting || !replyText.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-navy hover:bg-navy-mid disabled:opacity-50 flex items-center gap-2"
                  >
                    Send Reply
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-200 w-full"
                >
                  Close Window
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
