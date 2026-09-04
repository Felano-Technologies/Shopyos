import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiSun, FiMoon } from 'react-icons/fi';
import { getUnreadNotificationCount } from '../../services/notifications';
import { useThemeStore } from '../../store/themeStore';

export const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setPreference = useThemeStore((s) => s.setPreference);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount()
      .then((res) => setUnreadCount(Number(res?.unreadCount) || 0))
      .catch((err) => console.error('Failed to load unread notification count', err));
  }, []);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-end gap-2 px-8 sticky top-0 z-10">
      <button
        onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')}
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="p-2 rounded-lg text-subtle hover:text-navy hover:bg-surface-muted transition-colors"
      >
        {resolvedTheme === 'dark' ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
      </button>
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 text-subtle hover:text-navy transition-colors"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 border border-card text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
};
