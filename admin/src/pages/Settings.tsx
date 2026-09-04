import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiSave, FiAlertTriangle, FiSun, FiMoon, FiMonitor } from 'react-icons/fi';
import { getAdminPlatformSettings, updateAdminPlatformSettings } from '../services/admin';
import { Skeleton } from '../components/common/Skeleton';
import { useThemeStore, type ThemePreference } from '../store/themeStore';

const THEME_OPTIONS: { key: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { key: 'light', label: 'Light', icon: <FiSun className="w-4 h-4" /> },
  { key: 'dark', label: 'Dark', icon: <FiMoon className="w-4 h-4" /> },
  { key: 'system', label: 'System', icon: <FiMonitor className="w-4 h-4" /> },
];

export const Settings: React.FC = () => {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
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
          <h1 className="text-2xl font-bold text-body">Platform Settings</h1>
          <p className="text-sm text-secondary mt-1">Configure global platform rules.</p>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6 max-w-2xl">
          <p className="text-sm font-bold text-body mb-3">Appearance</p>
          <div className="flex gap-2 mb-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPreference(opt.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  preference === opt.key
                    ? 'bg-navy text-white border-navy'
                    : 'bg-surface-muted text-secondary border-border hover:text-body'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border p-6 max-w-2xl">
          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-surface-muted rounded-xl border border-border">
                  <div className="flex flex-col gap-2 flex-1 pr-4">
                    <Skeleton width={160} height={14} />
                    <Skeleton width="70%" height={11} />
                  </div>
                  <Skeleton width={44} height={24} borderRadius={999} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between p-4 bg-surface-muted rounded-xl border border-border">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-body flex items-center gap-2">
                      Maintenance Mode
                      {settings.maintenance_mode && <FiAlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    </p>
                    <p className="text-xs text-secondary mt-1">Display maintenance screen to all users except admins.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.maintenance_mode}
                      onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy" />
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted rounded-xl border border-border">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-body">Auto Approve Sellers</p>
                    <p className="text-xs text-secondary mt-1">Automatically approve new store registrations without admin review.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.auto_approve_sellers}
                      onChange={(e) => setSettings({ ...settings, auto_approve_sellers: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy" />
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
