import { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notificationService } from '../api/notificationService';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!token || !user) return;

    // Fetch initial history
    const loadHistory = async () => {
      try {
        const data = await notificationService.getHistory(1, 40);
        setNotifications(data.data || []);
        setUnreadCount(data.meta?.unreadCount || 0);
      } catch (err) {
        console.error('Erreur chargement notifications', err);
      }
    };

    loadHistory();

    // Initialize WebSockets
    // We use process.env or window.location.origin for the socket URL
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const backendUrl = apiUrl ? apiUrl.split('/api')[0] : window.location.origin;
    
    const newSocket = io(backendUrl, {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connecté');
    });

    newSocket.on('new_notification', (notif) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      if (notif.severityLevel === 'danger' || notif.severityLevel === 'error') toast.error(notif.title);
      else if (notif.severityLevel === 'success') toast.success(notif.title);
      else toast(notif.title);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  const toggleDrawer = () => setDrawerOpen(!drawerOpen);

  const markAllAsRead = async () => {
    try {
      await notificationService.markAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error('Erreur markAllAsRead');
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      toast.error('Erreur markAsReadItem');
    }
  };

  return (
    <NotificationContext.Provider value={{
      socket,
      notifications,
      unreadCount,
      drawerOpen,
      toggleDrawer,
      setDrawerOpen,
      markAllAsRead,
      markAsRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
};
