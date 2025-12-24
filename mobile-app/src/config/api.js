import axios from 'axios';

// Configure your Django backend URL here
// For local development, use your computer's IP address (not localhost)
// Find your IP: Windows (ipconfig), Mac/Linux (ifconfig)
export const API_BASE_URL = 'http://192.168.61.128:8000';  // Your IP address

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method.toUpperCase(), config.url);

    // If sending FormData, remove the default Content-Type header
    // to let the browser/axios set it with the correct boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.message);
    if (error.response?.status === 400) {
      console.error('400 Bad Request Details:', error.response?.data);
    }
    return Promise.reject(error);
  }
);

export default api;

