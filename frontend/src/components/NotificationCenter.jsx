import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import NotificationDrawer from './NotificationDrawer';

export default function NotificationCenter({ isSuperAdmin }) {
  const { unreadCount, toggleDrawer } = useNotifications();
  const notifColor = isSuperAdmin ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <>
      <button 
        onClick={toggleDrawer}
        className="relative p-2 text-dark-400 hover:text-dark-200 hover:bg-dark-800 rounded-lg transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className={`absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white ${notifColor} rounded-full border-2 border-dark-900`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      <NotificationDrawer />
    </>
  );
}
