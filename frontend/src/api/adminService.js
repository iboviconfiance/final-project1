import apiClient from './apiClient';

// ── ADMIN DASHBOARD ─────────────────────────────────

export const getDashboardStats = () => apiClient.get('/v1/admin/stats');

// ── MEMBRES ─────────────────────────────────────────

export const getMembers = () => apiClient.get('/v1/admin/members');

export const addMember = (data) => apiClient.post('/v1/admin/members', data);

export const changeMemberRole = (id, role) =>
  apiClient.put(`/v1/admin/members/${id}/role`, { role });

// ── EXPORT ──────────────────────────────────────────

export const exportTransactions = (params) =>
  apiClient.get('/v1/admin/export/transactions', { params, responseType: 'blob' });

// ── TEMPLATES ───────────────────────────────────────

export const getTemplates = () => apiClient.get('/v1/admin/templates');

export const updateTemplate = (name, data) =>
  apiClient.put(`/v1/admin/templates/${name}`, data);

export const previewTemplate = (name) =>
  apiClient.post(`/v1/admin/templates/${name}/preview`);

export const resetTemplate = (name) =>
  apiClient.post(`/v1/admin/templates/${name}/reset`);

// ── TICKETS (ADMIN) ─────────────────────────────────

export const getTickets = (params) =>
  apiClient.get('/tickets', { params });

export const respondTicket = (id, data) =>
  apiClient.post(`/tickets/${id}/respond`, data);
