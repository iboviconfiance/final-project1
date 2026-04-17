import apiClient from './apiClient';

// ── SYSTÈME ─────────────────────────────────────────

export const getSystemMode = () => apiClient.get('/v1/system/mode');

export const getQrToken = () => apiClient.get('/v1/system/qr-token');

export const verifyQrCode = (qrData) =>
  apiClient.post('/v1/system/verify-qr', { qrData });
