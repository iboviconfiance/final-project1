/**
 * Client Service — API du portail Self-Service
 */

import apiClient from './apiClient';

// ── PROFIL ──────────────────────────────────────────

export const getProfile = () => apiClient.get('/client/profile');

export const updateProfile = (data) => apiClient.put('/client/profile', data);

// ── FACTURES ────────────────────────────────────────

export const getInvoices = (params = {}) =>
  apiClient.get('/client/invoices', { params });

// ── CONSOMMATION ────────────────────────────────────

export const getConsumption = () => apiClient.get('/client/consumption');

// ── PAIEMENT RAPIDE ─────────────────────────────────

export const getPaymentMethod = () => apiClient.get('/client/payment-method');

export const savePaymentMethod = (data) =>
  apiClient.put('/client/payment-method', data);

export const deletePaymentMethod = () =>
  apiClient.delete('/client/payment-method');

// ── ABONNEMENT ──────────────────────────────────────

export const getSubscriptionStatus = () =>
  apiClient.get('/subscriptions/status');

export const getPlans = () => apiClient.get('/subscriptions/plans');

export const subscribe = (data) =>
  apiClient.post('/subscriptions/subscribe', data);

export const getSubscriptionHistory = () =>
  apiClient.get('/subscriptions/history');

// ── TICKETS ─────────────────────────────────────────

export const createTicket = (data) => apiClient.post('/tickets', data);

export const getMyTickets = () => apiClient.get('/tickets/my');
