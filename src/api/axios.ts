import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── CHANGE THIS to match your environment ───────────────────────────────────
const BASE_URL = 'http://52.48.121.185:5000';
//                       ↑ emulator
// const BASE_URL = 'http://192.168.1.X:5000';   ← real device (your LAN IP)
// ─────────────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15s — generous for mobile networks
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request (mirrors the web app's axios interceptor)
api.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('penzi_token');
      if (token) {
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
      await AsyncStorage.multiRemove(['penzi_token', 'penzi_user']);
      // Navigation is handled per-screen; just reject here
    }
    return Promise.reject(error);
  }
);

export default api;
