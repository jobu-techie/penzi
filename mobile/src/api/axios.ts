import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, clearToken } from '../utils/tokenStorage';

// ─── CHANGE THIS to match your environment ───────────────────────────────────
export const API_BASE_URL = 'http://52.48.121.185:5000';
//                                  ↑ live backend
// const API_BASE_URL = 'http://10.0.2.2:5000';  ← Android emulator loopback
// const API_BASE_URL = 'http://192.168.1.X:5000'; ← real device (your LAN IP)
// ─────────────────────────────────────────────────────────────────────────────

// Shared secret gating the /webhook/onfon endpoint — must match the
// backend's ONFON_WEBHOOK_TOKEN. A logged-in user's JWT is also attached on
// webhook calls (see below) so the backend can bind the SMS "sender" to the
// authenticated user instead of trusting an arbitrary client-supplied phone.
export const WEBHOOK_TOKEN = 'jobu';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15s — generous for mobile networks
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async config => {
    try {
      const isWebhook = config.url?.includes('/webhook/');
      const token = await getToken();

      if (isWebhook) {
        config.headers['X-Webhook-Token'] = WEBHOOK_TOKEN;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } else if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // AsyncStorage read failed — continue without token
      console.warn('Could not read token from AsyncStorage', e);
    }
    return config;
  },
  error => Promise.reject(error)
);

// Handle 401s globally — token expired, kick to login
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Clear stale credentials
      await clearToken();
      await AsyncStorage.removeItem('penzi_user');
      // Navigation is handled per-screen; just reject here
    }
    return Promise.reject(error);
  }
);

export default api;
