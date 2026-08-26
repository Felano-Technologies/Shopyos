import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { getAdminAuditLogs } from '../services/admin';
import { FiActivity, FiUser, FiClock } from 'react-icons/fi';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getAdminAuditLogs();
        setLogs(data?.logs || data || []);
      } catch (err) {
        console.error("Failed to load audit logs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <>
      <Helmet>
        <title>Audit Logs | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Audit Logs</h1>
            <p className="text-sm text-gray-500 mt-1">Track administrative and system-wide activity.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center text-gray-500 text-sm">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-sm">No activity recorded recently.</div>
            ) : (
              <div className="relative border-l border-gray-200 ml-4 space-y-8">
                {logs.map((log: any, i) => (
                  <div key={i} className="relative pl-8">
                    <div className="absolute -left-[1.35rem] top-1 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      <FiActivity className="w-4 h-4 text-navy" />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <FiClock className="w-3.5 h-3.5" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-2">
                        <p className="text-gray-900 font-medium text-sm">{log.action || 'Performed action'}</p>
                        
                        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500 border-t border-gray-200 pt-3">
                          <FiUser className="w-3.5 h-3.5" />
                          <span>Admin ID: {log.adminId || 'System'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
