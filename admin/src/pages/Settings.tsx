import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiSave, FiAlertTriangle } from 'react-icons/fi';
import { getAdminPlatformSettings, updateAdminPlatformSettings } from '../services/admin';

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState({
    maintenance_mode: false,
    auto_approve_sellers: false,
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await getAdminPlatformSettings();
      if (res?.settings) {
        setSettings({
          maintenance_mode: res.settings.maintenance_mode || false,
          auto_approve_sellers: res.settings.auto_approve_sellers || false,
        });
      }
    } catch (err) {
      console.error('Failed to load platform settings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    if (settings.maintenance_mode && !window.confirm('Enabling maintenance mode will lock out every non-admin user of the platform. Continue?')) {
      return;
    }
    try {
      setSubmitting(true);
      await updateAdminPlatformSettings(settings);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', title: 'Success', message: 'Settings saved successfully' } }));
    } catch (err) {
      console.error('Failed to save platform settings', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', title: 'Error', message: 'Failed to save settings' } }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Settings | Shopyos Admin</title>
      </Helmet>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure global platform rules.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-navy border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      Maintenance Mode
                      {settings.maintenance_mode && <FiAlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Display maintenance screen to all users except admins.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.maintenance_mode}
                      onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-gray-900">Auto Approve Sellers</p>
                    <p className="text-xs text-gray-500 mt-1">Automatically approve new store registrations without admin review.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.auto_approve_sellers}
                      onChange={(e) => setSettings({ ...settings, auto_approve_sellers: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy" />
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-navy-mid transition-colors shadow-sm disabled:opacity-50"
                >
                  <FiSave className="w-4 h-4" /> {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
