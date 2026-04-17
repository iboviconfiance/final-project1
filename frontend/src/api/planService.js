import apiClient from './apiClient';

/**
 * Service pour la gestion des offres / plans d'abonnement
 */

export const getPlans = () =>
  apiClient.get('/subscriptions/plans');

export const createPlan = (data) =>
  apiClient.post('/subscriptions/plans', data);
