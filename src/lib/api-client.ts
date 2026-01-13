/**
 * API Client for CGIWorkFlo Backend
 * Handles all HTTP requests with authentication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Get base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add JWT token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 - Unauthorized (invalid/expired token)
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('cgiworkflo_current_user');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    // Handle 403 - Forbidden (insufficient permissions)
    if (error.response?.status === 403) {
      console.error('Permission denied:', error.response.data);
    }

    // Handle 429 - Rate limit
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded - please try again later');
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error - unable to reach API');
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API METHODS
// ============================================================================

export const api = {
  // Authentication
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),

    devLogin: (role: string) =>
      apiClient.post('/auth/dev-login', { role }),

    register: (data: {
      name: string;
      email: string;
      password: string;
      role: string;
      address?: string;
      phone?: string;
      franchiseId?: string;
    }) => apiClient.post('/auth/register', data),

    me: () => apiClient.get('/auth/me'),

    logout: () => apiClient.post('/auth/logout'),
  },

  // WebSocket Authentication
  websocket: {
    getAuthCode: () => apiClient.post('/ws/auth-code'),
  },

  // Custom Forms
  customForms: {
    getActive: () => apiClient.get('/custom-forms/active'),

    updateActive: (schema: any, name?: string, description?: string) =>
      apiClient.put('/custom-forms/active', {
        form_schema: schema,
        name,
        description,
      }),

    reset: (defaultSchema: any) =>
      apiClient.post('/custom-forms/reset', { defaultSchema }),
  },

  // AARs
  aars: {
    /**
     * List AARs with filtering and pagination
     * @param params Query parameters (search, category, material, damageType, dateFrom, dateTo, userId, sortBy, page, limit)
     */
    list: (params?: any) => apiClient.get('/aars', { params }),

    /**
     * Get single AAR by ID
     * @param id AAR ID
     */
    get: (id: string) => apiClient.get(`/aars/${id}`),

    /**
     * Create new AAR with form data and photos
     * @param formData FormData object containing form data, formId, formVersion, photos, and photoMetadata
     * @param config Optional axios config for upload progress tracking
     */
    create: (formData: FormData, config?: any) =>
      apiClient.post('/aars', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...config,
      }),

    /**
     * Update existing AAR (not yet implemented on backend)
     * @param id AAR ID
     * @param data Updated data
     */
    update: (id: string, data: any) => apiClient.put(`/aars/${id}`, data),

    /**
     * Soft delete AAR
     * @param id AAR ID
     */
    delete: (id: string) => apiClient.delete(`/aars/${id}`),
  },

  // Users
  users: {
    list: () => apiClient.get('/users'),
    get: (id: string) => apiClient.get(`/users/${id}`),
    create: (data: any) => apiClient.post('/users', data),
    update: (id: string, data: any) => apiClient.put(`/users/${id}`, data),
    delete: (id: string) => apiClient.delete(`/users/${id}`),
    updatePreferences: (preferences: {
      language?: string;
      theme?: string;
      unitArea?: string;
      unitLiquid?: string;
    }) => apiClient.patch('/users/preferences', preferences),
  },

  // Conversations & Messaging
  conversations: {
    list: () => apiClient.get('/conversations'),
    get: (id: string) => apiClient.get(`/conversations/${id}`),
    create: (data: { type: string; participantIds: string[]; name?: string }) =>
      apiClient.post('/conversations', data),
    getMessages: (conversationId: string, params?: any) =>
      apiClient.get(`/conversations/${conversationId}/messages`, { params }),
    sendMessage: (
      conversationId: string,
      data: { content: string; messageType?: string; metadata?: string }
    ) => apiClient.post(`/conversations/${conversationId}/messages`, data),
    markAsRead: (conversationId: string) => apiClient.patch(`/conversations/${conversationId}/read`),
    addParticipant: (conversationId: string, userId: string) =>
      apiClient.post(`/conversations/${conversationId}/participants`, { userId }),
    removeParticipant: (conversationId: string, userId: string) =>
      apiClient.delete(`/conversations/${conversationId}/participants/${userId}`),
    getOpen: () => apiClient.get('/conversations/open'),
  },

  // Presence & Online Status
  presence: {
    heartbeat: () => apiClient.post('/presence/heartbeat'),
    getStatus: (userIds: string[]) => apiClient.post('/presence/status', { userIds }),
  },

  // Batched Sync for Efficient Polling
  chat: {
    sync: (data: {
      lastSync?: string;
      activeConversationId?: string;
      conversationTimestamps?: Record<string, string>;
      presenceUserIds?: string[];
    }) => apiClient.post('/chat/sync', data),
  },

  // File Uploads
  uploads: {
    uploadFile: (file: File, type: string = 'file', config?: any) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      return apiClient.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        ...config, // ADDED: Allow passing onUploadProgress and other axios config
      });
    },
  },
};

export default apiClient;
