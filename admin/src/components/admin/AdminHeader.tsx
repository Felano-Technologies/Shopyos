import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { getUnreadNotificationCount } from '../../services/notifications';

export const AdminHeader: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    getUnreadNotificationCount()
      .then((res) => setUnreadCount(Number(res?.unreadCount) || 0))
      .catch((err) => console.error('Failed to load unread notification count', err));
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-end px-8 sticky top-0 z-10">
      <button
        onClick={() => navigate('/notifications')}
        className="relative p-2 text-gray-400 hover:text-navy transition-colors"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 border border-white text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  );
};
