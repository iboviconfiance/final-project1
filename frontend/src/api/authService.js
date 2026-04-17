/**
 * Auth Service — Login, Register, Logout
 * Aucun token n'est jamais exposé dans les logs.
 */

import apiClient from './apiClient';

/**
 * Décode un JWT sans vérification de signature.
 * La vérification est faite côté backend — ici on lit juste le payload.
 */
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Vérifie si un token est expiré.
 */
function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  // Marge de 30 secondes pour éviter les race conditions
  return (decoded.exp * 1000) < (Date.now() - 30000);
}

/**
 * Connexion — POST /api/auth/login
 */
export async function login(email, password) {
  const response = await apiClient.post('/auth/login', { email, password });
  const { token, data } = response.data;

  if (token) {
    localStorage.setItem('sf_token', token);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    localStorage.setItem('sf_org', JSON.stringify(data.organization));
  }

  return {
    token,
    user: data.user,
    organization: data.organization,
  };
}

/**
 * Inscription — POST /api/auth/register
 */
export async function register({ orgName, adminEmail, password, referralCode }) {
  const response = await apiClient.post('/auth/register', {
    orgName,
    adminEmail,
    password,
    referralCode: referralCode || undefined,
  });
  const { token, data } = response.data;

  if (token) {
    localStorage.setItem('sf_token', token);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    localStorage.setItem('sf_org', JSON.stringify(data.organization));
  }

  return {
    token,
    user: data.user,
    organization: data.organization,
  };
}

/**
 * Déconnexion — Supprime tout du localStorage
 */
export function logout() {
  localStorage.removeItem('sf_token');
  localStorage.removeItem('sf_user');
  localStorage.removeItem('sf_org');
}

/**
 * Récupère l'utilisateur stocké en localStorage (si existant et token valide).
 */
export function getStoredAuth() {
  const token = localStorage.getItem('sf_token');
  const userStr = localStorage.getItem('sf_user');
  const orgStr = localStorage.getItem('sf_org');

  if (!token || isTokenExpired(token)) {
    logout(); // Nettoyer si expiré
    return null;
  }

  try {
    const user = userStr ? JSON.parse(userStr) : null;
    const organization = orgStr ? JSON.parse(orgStr) : null;
    const decoded = decodeToken(token);

    return {
      user,
      organization,
      role: decoded?.role || user?.role,
      organizationId: decoded?.organizationId,
    };
  } catch {
    logout();
    return null;
  }
}

/**
 * Vérifie si l'utilisateur est actuellement authentifié.
 */
export function isAuthenticated() {
  const token = localStorage.getItem('sf_token');
  return !!token && !isTokenExpired(token);
}

/**
 * Liste les organisations actives (publiques).
 * Pas besoin de JWT — route publique.
 */
export async function listOrganizations() {
  const response = await apiClient.get('/auth/organizations');
  return response.data.data.organizations;
}

/**
 * Inscription Client — POST /api/auth/register-client
 * Le client choisit une organisation et crée son compte (rôle "user").
 */
export async function registerClient({ email, password, organizationId, firstName, lastName, phone, referralCode }) {
  const response = await apiClient.post('/auth/register-client', {
    email,
    password,
    organizationId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    phone: phone || undefined,
    referralCode: referralCode || undefined,
  });
  const { token, data } = response.data;

  if (token) {
    localStorage.setItem('sf_token', token);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    localStorage.setItem('sf_org', JSON.stringify(data.organization));
  }

  return {
    token,
    user: data.user,
    organization: data.organization,
  };
}

export { decodeToken, isTokenExpired };
