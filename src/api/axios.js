import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const WEBHOOK_TOKEN = import.meta.env.VITE_WEBHOOK_TOKEN || '';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const isWebhook = config.url?.includes('/webhook/');
  const isAdmin = config.url?.includes('/admin/');

  if (isWebhook) {
    // Static token authenticates genuine SMS-gateway traffic; the JWT (when
    // the caller is a logged-in user simulating SMS) lets the backend
    // override the sender to the authenticated user's own phone number.
    config.headers['X-Webhook-Token'] = WEBHOOK_TOKEN;
    const token = localStorage.getItem('penzi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else if (isAdmin) {
    const adminToken = localStorage.getItem('penzi_admin_token');
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    }
  } else {
    const token = localStorage.getItem('penzi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  // Don't force Content-Type for FormData
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or missing — clear and redirect to login
      localStorage.removeItem('penzi_token');
      localStorage.removeItem('penzi_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
