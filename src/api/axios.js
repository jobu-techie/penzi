import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:5000',
});

api.interceptors.request.use((config) => {
  const isWebhook = config.url?.includes('/webhook/');

  if (!isWebhook) {
    const token = localStorage.getItem("penzi_token"); // ← read directly
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
// Add this BELOW your request interceptor in api/axios.js
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
  // Don't force Content-Type for FormData
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

export default api;