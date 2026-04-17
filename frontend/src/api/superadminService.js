import apiClient from './apiClient';

// ── ORGANISATIONS ───────────────────────────────────

export const getAllOrganizations = (params) =>
  apiClient.get('/v1/superadmin/organizations', { params });

export const getOrganizationDetails = (id) =>
  apiClient.get(`/v1/superadmin/organizations/${id}`);

export const suspendOrganization = (id) =>
  apiClient.put(`/v1/superadmin/organizations/${id}/suspend`);

export const activateOrganization = (id) =>
  apiClient.put(`/v1/superadmin/organizations/${id}/activate`);

// ── STATS GLOBALES ──────────────────────────────────

export const getGlobalStats = () =>
  apiClient.get('/v1/superadmin/stats');

// ── AUDIT LOGS ──────────────────────────────────────

export const getAuditLogs = (params) =>
  apiClient.get('/v1/superadmin/audit-logs', { params });

// ── IMPERSONATION ───────────────────────────────────

export const impersonateUser = (userId, data) =>
  apiClient.post(`/v1/superadmin/impersonate/${userId}`, data);

// ── ANNONCES ────────────────────────────────────────

export const getAnnouncements = () =>
  apiClient.get('/v1/superadmin/announcements');

export const createAnnouncement = (data) =>
  apiClient.post('/v1/superadmin/announcements', data);

export const deleteAnnouncement = (id) =>
  apiClient.delete(`/v1/superadmin/announcements/${id}`);

// ── VERSION MANAGEMENT ──────────────────────────────

export const getVersions = () =>
  apiClient.get('/v1/superadmin/versions');

export const forceVersion = (orgId, version) =>
  apiClient.post(`/v1/superadmin/versions/${orgId}/force`, { version });

// ── VALIDATION PAIEMENT ─────────────────────────────

export const forceValidatePayment = (transactionId) =>
  apiClient.post(`/v1/superadmin/payments/${transactionId}/validate`);
