import { useNotifications } from '../context/NotificationContext';
import { X, CheckCheck, Bell, ShieldAlert, CreditCard, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotificationDrawer() {
  const { notifications, drawerOpen, toggleDrawer, markAllAsRead, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) markAsRead(notif.id);
    if (notif.data?.link) {
      toggleDrawer();
      navigate(notif.data.link);
    }
  };

  const getIconAndColor = (severity) => {
    switch (severity) {
      case 'success': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
      case 'warning': return { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' };
      case 'danger': 
      case 'error': return { icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10' };
      case 'info':
      default: return { icon: Info, color: 'text-brand-500', bg: 'bg-brand-500/10' };
    }
  };

  return (
    <>
      {/* Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={toggleDrawer}
        />
      )}

      {/* Drawer */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-96 bg-dark-950 border-l border-dark-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800 bg-dark-900">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-dark-200" />
            <h2 className="text-lg font-semibold text-white">Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some(n => !n.isRead) && (
              <button 
                onClick={markAllAsRead}
                className="p-2 text-dark-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-colors group relative"
                title="Tout marquer comme lu"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={toggleDrawer}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-dark-400 flex flex-col items-center">
              <Bell className="w-12 h-12 mb-3 opacity-20" />
              <p>Aucune notification</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const { icon: Icon, color, bg } = getIconAndColor(notif.severityLevel);
              return (
                <div 
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.isRead 
                      ? 'bg-dark-900 border-dark-800 hover:border-dark-700 opacity-70' 
                      : 'bg-dark-900 border-dark-700 hover:border-dark-600 shadow-lg'
                  }`}
                >
                  {!notif.isRead && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                  )}
                  <div className="flex gap-3">
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium pr-4 ${notif.isRead ? 'text-dark-200' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-dark-400 mt-1 mb-2 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-dark-500 font-medium">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  );
}
