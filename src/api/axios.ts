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

export const API_URL = BASE_URL;
export const WEBHOOK_TOKEN = 'jobu';
export default api;