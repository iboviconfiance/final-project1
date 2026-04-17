/**
 * Marketing Service — API Frontend pour coupons, referrals, affiliates
 */
import apiClient from './apiClient';

// ─── COUPONS (Client) ──────────────────────────
export const validateCoupon = (code, planId) =>
  apiClient.post('/v1/coupons/validate', { code, planId });

// ─── REFERRALS (Client) ────────────────────────
export const getMyReferrals = () =>
  apiClient.get('/v1/coupons/referrals/my');

// ─── COUPONS (Admin) ───────────────────────────
export const listCoupons = (params = {}) =>
  apiClient.get('/v1/coupons', { params });

export const createCoupon = (data) =>
  apiClient.post('/v1/coupons', data);

export const updateCoupon = (id, data) =>
  apiClient.put(`/v1/coupons/${id}`, data);

export const deleteCoupon = (id) =>
  apiClient.delete(`/v1/coupons/${id}`);

export const getCouponStats = () =>
  apiClient.get('/v1/coupons/stats');

// ─── REFERRALS (Admin) ─────────────────────────
export const getOrgReferrals = (params = {}) =>
  apiClient.get('/v1/coupons/referrals/admin', { params });

export const getReferralConfig = () =>
  apiClient.get('/v1/coupons/referrals/config');

export const updateReferralConfig = (data) =>
  apiClient.put('/v1/coupons/referrals/config', data);

// ─── AFFILIATES (Super-Admin) ──────────────────
export const listAffiliates = (params = {}) =>
  apiClient.get('/v1/superadmin/affiliates', { params });

export const createAffiliate = (data) =>
  apiClient.post('/v1/superadmin/affiliates', data);

export const updateAffiliate = (id, data) =>
  apiClient.put(`/v1/superadmin/affiliates/${id}`, data);

export const getAffiliateCommissions = (id) =>
  apiClient.get(`/v1/superadmin/affiliates/${id}/commissions`);

export const payCommissions = (id, commissionIds) =>
  apiClient.post(`/v1/superadmin/affiliates/${id}/pay`, { commissionIds });
