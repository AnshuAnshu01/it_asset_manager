import api from './client';
import { encryptPassword } from './crypto';

export const authAPI = {
  login: async (username, password) => {
    // Encrypt password client-side so original password never appears in Network Payload
    const securePassword = await encryptPassword(password);
    return api.post('/auth/login', { username, password: securePassword });
  },
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
};

export const usersAPI = {
  list: () => api.get('/users/'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, new_password) => api.put(`/users/${id}/reset-password`, { new_password }),
};

export const assetsAPI = {
  list: () => api.get('/assets/'),
  get: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets/', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  delete: (id) => api.delete(`/assets/${id}`),
  assign: (id, data) => api.post(`/assets/${id}/assign`, data),
  return: (id) => api.post(`/assets/${id}/return`),
};

export const ticketsAPI = {
  list: () => api.get('/tickets/'),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets/', data),
  update: (id, data) => api.put(`/tickets/${id}`, data),
  assign: (id, data) => api.post(`/tickets/${id}/assign`, data),
  process: (id) => api.post(`/tickets/${id}/process`),
  resolve: (id, data) => api.post(`/tickets/${id}/resolve`, data),
  close: (id) => api.post(`/tickets/${id}/close`),
  escalate: (id, data) => api.post(`/tickets/${id}/escalate`, data),
};

export const reportsAPI = {
  tickets: () => api.get('/reports/tickets'),
  assets: () => api.get('/reports/assets'),
  sla: () => api.get('/reports/sla'),
  supportWorkload: () => api.get('/reports/support-workload'),
  activityLogs: (params) => api.get('/reports/activity-logs', { params }),
};

export const assetRequestsAPI = {
  list: (params) => api.get('/asset-requests/', { params }),
  get: (id) => api.get(`/asset-requests/${id}`),
  create: (data) => api.post('/asset-requests/', data),
  assign: (id, data) => api.post(`/asset-requests/${id}/assign`, data),
  reject: (id, data) => api.post(`/asset-requests/${id}/reject`, data),
  cancel: (id) => api.delete(`/asset-requests/${id}`),
  availableInventory: (assetType) => api.get('/asset-requests/inventory/available', { params: { asset_type: assetType } }),
};
