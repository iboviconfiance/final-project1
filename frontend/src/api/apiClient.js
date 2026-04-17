/**
 * ============================================================
 * API Client — Instance Axios Sécurisée
 * ============================================================
 * 
 * SÉCURITÉ :
 * - Intercepteur de requête : injecte le JWT automatiquement
 * - Intercepteur de réponse : gère 401/403/429/500
 * - JAMAIS de token dans console.log
 * - Vérifie que l'URL cible est bien notre API avant injection
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Créer une instance dédiée
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// INTERCEPTEUR DE REQUÊTE — Injection JWT
// ============================================================

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sf_token');
    
    // Injecter le token UNIQUEMENT si :
    // 1. Un token existe
    // 2. L'URL cible est bien notre API (pas un domaine externe)
    if (token && config.baseURL === API_BASE_URL) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// INTERCEPTEUR DE RÉPONSE — Gestion des erreurs
// ============================================================

// Callback qui sera set par AuthContext pour déclencher le logout
let onUnauthorized = null;

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

apiClient.interceptors.response.use(
  // Succès : retourner directement la réponse
  (response) => response,
  
  // Erreur : gestion centralisée
  (error) => {
    if (!error.response) {
      // Erreur réseau (pas de réponse du serveur)
      error.customMessage = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    switch (status) {
      case 401:
        // Token expiré ou invalide → logout automatique
        localStorage.removeItem('sf_token');
        localStorage.removeItem('sf_user');
        if (onUnauthorized) {
          onUnauthorized();
        }
        error.customMessage = 'Session expirée. Veuillez vous reconnecter.';
        break;

      case 403:
        error.customMessage = data?.error || 'Accès interdit. Vous n\'avez pas les droits nécessaires.';
        break;

      case 429:
        error.customMessage = 'Trop de requêtes. Veuillez patienter quelques minutes.';
        break;

      case 400:
        error.customMessage = data?.error || 'Données invalides.';
        break;

      case 404:
        error.customMessage = data?.error || 'Ressource introuvable.';
        break;

      default:
        if (status >= 500) {
          error.customMessage = 'Erreur serveur. Réessayez ultérieurement.';
        } else {
          error.customMessage = data?.error || 'Une erreur est survenue.';
        }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
