import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import App from './App';
import './index.css';

/**
 * Entry Point — SubFlow Frontend
 * 
 * Providers (de l'extérieur vers l'intérieur) :
 * 1. BrowserRouter  → Routage SPA
 * 2. AuthProvider   → État d'authentification global
 * 3. App            → Routage de pages
 * 4. Toaster        → Notifications toast
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#34d399', secondary: '#1e293b' },
              },
              error: {
                iconTheme: { primary: '#f43f5e', secondary: '#1e293b' },
                duration: 6000,
              },
            }}
          />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
