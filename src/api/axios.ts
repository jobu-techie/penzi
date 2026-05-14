import axios from 'axios';
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = 'http://10.0.2.2:5000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ← Add this — attaches JWT token to every non-webhook request
api.interceptors.request.use(async (config) => {
  const isWebhook = config.url?.includes('/webhook/');

  if (!isWebhook) {
    const token = await AsyncStorage.getItem('penzi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']; // let axios set multipart boundary
  }

  return config;
});

export const API_URL = BASE_URL;
export const WEBHOOK_TOKEN = 'jobu';
export default api;