import apiClient from './apiClient';

export const notificationService = {
  getHistory: async (page = 1, limit = 20) => {
    const response = await apiClient.get('/notifications', { params: { page, limit } });
    return response.data;
  },
  markAsRead: async (id = null) => {
    const response = await apiClient.put('/notifications/read', { id });
    return response.data;
  }
};
