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

  // Don't force Content-Type for FormData
  if (!(config.data instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  return config;
});

export default api;