import React, { useState, useEffect } from 'react';
import { Bell, Check, Info } from 'lucide-react';
import API from '../services/api';

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await API.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id) => {
    try {
      await API.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl glass-panel bg-slate-900/95 border border-slate-800 shadow-2xl z-50 p-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-rose-400" /> Notifications
            </h4>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
              {unreadCount} Unread
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2.5">
            {notifications.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-6">No notifications yet.</p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-3 rounded-xl border text-xs transition ${
                    notif.isRead
                      ? 'bg-slate-950/40 border-slate-900 text-slate-400'
                      : 'bg-rose-950/20 border-rose-900/40 text-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-rose-300">{notif.title}</p>
                    {!notif.isRead && (
                      <button
                        onClick={() => markRead(notif._id)}
                        className="text-xs text-rose-400 hover:text-rose-200 flex items-center gap-1"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-slate-300 leading-relaxed">{notif.message}</p>
                  <span className="text-[10px] text-slate-500 mt-2 block">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
