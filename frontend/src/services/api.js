import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
  
  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  }
};

// Sites API
export const sitesAPI = {
  getAllSites: async () => {
    const response = await api.get('/sites');
    return response.data;
  },
  
  getSite: async (id) => {
    const response = await api.get(`/sites/${id}`);
    return response.data;
  },
  
  createSite: async (siteData) => {
    const response = await api.post('/sites', siteData);
    return response.data;
  },
  
  updateSite: async (id, siteData) => {
    const response = await api.put(`/sites/${id}`, siteData);
    return response.data;
  },
  
  deleteSite: async (id) => {
    const response = await api.delete(`/sites/${id}`);
    return response.data;
  }
};

// Readings API
export const readingsAPI = {
  getReadings: async (params = {}) => {
    const response = await api.get('/readings', { params });
    return response.data;
  },
  
  getReading: async (id) => {
    const response = await api.get(`/readings/${id}`);
    return response.data;
  },
  
  getReadingStats: async (params = {}) => {
    const response = await api.get('/readings/stats/summary', { params });
    return response.data;
  },
  
  exportReadings: async (params = {}) => {
    const response = await api.get('/readings/export/data', { params });
    return response.data;
  },
  
  exportReadingsCSV: async (params = {}) => {
    const response = await api.get('/readings/export/data', { 
      params: { ...params, format: 'csv' },
      responseType: 'blob'
    });
    return response;
  }
};

// Alerts API
export const alertsAPI = {
  getAlerts: async (params = {}) => {
    const response = await api.get('/alerts', { params });
    return response.data;
  },
  
  getAlert: async (id) => {
    const response = await api.get(`/alerts/${id}`);
    return response.data;
  },
  
  acknowledgeAlert: async (id) => {
    const response = await api.put(`/alerts/${id}/acknowledge`);
    return response.data;
  },
  
  createAlert: async (alertData) => {
    const response = await api.post('/alerts', alertData);
    return response.data;
  },
  
  getAlertStats: async (params = {}) => {
    const response = await api.get('/alerts/stats/summary', { params });
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  getUser: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  changePassword: async (id, passwordData) => {
    const response = await api.put(`/users/${id}/password`, passwordData);
    return response.data;
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }
};

export default api;