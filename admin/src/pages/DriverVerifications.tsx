import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle, FiUserCheck, FiFileText } from 'react-icons/fi';
import { getPendingDriverVerifications, approveDriverVerification, rejectDriverVerification } from '../services/admin';

export const DriverVerifications: React.FC = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const res = await getPendingDriverVerifications();
      if (res.success || res.data) setVerifications(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, []);

  const handleApprove = async () => {
    if (!selectedDriver) return;
    try {
      setSubmitting(true);
      await approveDriverVerification(selectedDriver.id);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Driver approved' } }));
      setSelectedDriver(null);
      fetchVerifications();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedDriver) return;
    try {
      setSubmitting(true);
      await rejectDriverVerification(selectedDriver.id, rejectReason);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Driver rejected' } }));
      setSelectedDriver(null);
      setRejectReason('');
      fetchVerifications();
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: err.message || 'Action failed' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Driver Verifications</h1>
        <p className="text-sm text-slate-500">Review and approve new delivery driver applications</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
          </div>
        ) : verifications.length === 0 ? (
          <div className="text-center p-12 text-slate-500">
            <FiUserCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No pending driver verifications</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Driver Name</th>
                <th className="px-6 py-4">Vehicle Type</th>
                <th className="px-6 py-4">License Plate</th>
                <th className="px-6 py-4">Applied On</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {verifications.map(d => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{d.full_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 capitalize">{d.vehicle_type || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{d.license_plate || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedDriver(d)}
                      className="text-navy hover:text-navy-mid text-sm font-semibold"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">Review Application</h2>
              <button onClick={() => setSelectedDriver(null)} className="text-slate-400 hover:text-slate-600"><FiXCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Driver Info</h3>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Name:</strong> {selectedDriver.full_name}</p>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Phone:</strong> {selectedDriver.phone_number}</p>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Email:</strong> {selectedDriver.email}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Vehicle Info</h3>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Type:</strong> <span className="capitalize">{selectedDriver.vehicle_type}</span></p>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Make/Model:</strong> {selectedDriver.vehicle_make} {selectedDriver.vehicle_model}</p>
                  <p className="text-sm text-slate-500 mb-1"><strong className="text-slate-700">Plate:</strong> {selectedDriver.license_plate}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2"><FiFileText /> Documents</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedDriver.id_card_url && (
                    <div className="border border-slate-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2">ID Card / Passport</p>
                      <img src={selectedDriver.id_card_url} alt="ID" className="w-full h-32 object-cover rounded-lg bg-slate-100" />
                    </div>
                  )}
                  {selectedDriver.drivers_license_url && (
                    <div className="border border-slate-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Driver's License</p>
                      <img src={selectedDriver.drivers_license_url} alt="License" className="w-full h-32 object-cover rounded-lg bg-slate-100" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Rejection Reason (if rejecting)</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/10 focus:border-red-500 resize-none"
                  placeholder="Only required if rejecting..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={handleReject}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-100 hover:bg-red-200 transition-colors"
              >
                Reject Application
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <FiCheckCircle className="w-4 h-4"/> Approve Driver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
