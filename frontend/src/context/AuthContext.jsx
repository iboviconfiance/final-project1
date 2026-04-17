import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getStoredAuth,
} from '../api/authService';
import { setUnauthorizedHandler } from '../api/apiClient';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

// Durée d'inactivité avant auto-logout (30 minutes)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

/**
 * Retourne le path par défaut selon le rôle de l'utilisateur.
 */
function getDefaultPath(role) {
  switch (role) {
    case 'superadmin':
      return '/superadmin';
    case 'admin':
    case 'manager':
    case 'staff':
    case 'accountant':
      return '/admin';
    case 'user':
    default:
      return '/dashboard';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [role, setRole] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef(null);
  const navigate = useNavigate();

  // ── AUTO-LOGOUT : Réinitialiser le timer à chaque activité ──
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (isAuthenticated) {
      inactivityTimer.current = setTimeout(() => {
        toast.error('Session expirée par inactivité.', { duration: 5000 });
        performLogout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetInactivityTimer));

    return () => {
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // ── INITIALISATION : Charger l'auth depuis localStorage ──
  useEffect(() => {
    const stored = getStoredAuth();
    if (stored) {
      setUser(stored.user);
      setOrganization(stored.organization);
      setRole(stored.role);
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  // ── Enregistrer le handler de 401 dans apiClient ──
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setOrganization(null);
      setRole(null);
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  // ── LOGIN ──
  const login = useCallback(async (email, password) => {
    const result = await apiLogin(email, password);
    setUser(result.user);
    setOrganization(result.organization);
    setRole(result.user.role);
    setIsAuthenticated(true);
    resetInactivityTimer();

    // Redirection selon le rôle
    const targetPath = getDefaultPath(result.user.role);
    navigate(targetPath, { replace: true });

    return result;
  }, [navigate, resetInactivityTimer]);

  // ── REGISTER ──
  const register = useCallback(async (data) => {
    const result = await apiRegister(data);
    setUser(result.user);
    setOrganization(result.organization);
    setRole(result.user.role);
    setIsAuthenticated(true);
    resetInactivityTimer();

    navigate(getDefaultPath(result.user.role), { replace: true });
    return result;
  }, [navigate, resetInactivityTimer]);

  // ── LOGOUT ──
  const performLogout = useCallback(() => {
    apiLogout();
    setUser(null);
    setOrganization(null);
    setRole(null);
    setIsAuthenticated(false);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    navigate('/login', { replace: true });
  }, [navigate]);

  const value = {
    user,
    organization,
    role,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: performLogout,
    getDefaultPath,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook pour accéder au contexte d'authentification.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { getDefaultPath };
export default AuthContext;
