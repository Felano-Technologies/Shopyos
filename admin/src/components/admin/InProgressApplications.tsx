// components/admin/InProgressApplications.tsx
// Sellers/drivers who have started the onboarding wizard (verification_
// applications) but have no stores/driver_profiles row yet — invisible to
// the Stores/Riders tables (which list the operational table, not
// verification_applications) until the applicant actually submits. Shown
// here, inline in Store/Rider Management, so an admin can see progress and
// assist an applicant before they've finished — mirrors what the old
// unified Verifications admin tab did, minus the separate nav tab.
import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { getVerificationApplications } from '../../services/admin';
import { ApplicationVerificationPanel, APP_STATUS_LABEL, APP_STATUS_COLOR } from './ApplicationVerificationPanel';

export const InProgressApplications: React.FC<{ role: 'seller' | 'driver' }> = ({ role }) => {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchApps = () => {
    setLoading(true);
    getVerificationApplications({ role, hasEntity: false })
      .then((res) => setApps(Array.isArray(res?.applications) ? res.applications : []))
      .catch((err) => console.error('Failed to load in-progress applications', err))
      .finally(() => setLoading(false));
  };

  useEffect(fetchApps, [role]);

  if (!loading && apps.length === 0) return null;

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-muted/50 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-bold text-body">
            Applications In Progress {apps.length > 0 && `(${apps.length})`}
          </p>
          <p className="text-xs text-secondary mt-0.5">
            {role === 'seller' ? 'Sellers mid-onboarding — no store record yet.' : 'Drivers mid-onboarding — no driver profile yet.'}
          </p>
        </div>
        {expanded ? <FiChevronUp className="w-4 h-4 text-subtle" /> : <FiChevronDown className="w-4 h-4 text-subtle" />}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {loading ? (
            <div className="px-5 py-4 text-sm text-secondary">Loading...</div>
          ) : (
            apps.map((app) => (
              <div key={app.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-body">{app.applicant?.email || 'Unknown'}</p>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${APP_STATUS_COLOR[app.status] || 'bg-gray-50 text-gray-600'}`}>
                    {APP_STATUS_LABEL[app.status] || app.status}
                  </span>
                </div>
                <button onClick={() => setSelected(app)} className="text-navy hover:text-navy/70 transition-colors font-semibold text-sm">
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-body">{selected.applicant?.email || 'Applicant'}</h2>
              <button onClick={() => setSelected(null)} className="text-subtle hover:text-secondary text-sm font-semibold">Close</button>
            </div>
            <ApplicationVerificationPanel applicationId={selected.id} onChanged={fetchApps} />
          </div>
        </div>
      )}
    </div>
  );
};
