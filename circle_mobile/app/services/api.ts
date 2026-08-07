// lib/api.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Types
interface ApiOptions extends RequestInit {
  admin?: boolean;
  body?: any;
}

interface ApiResponse<T = any> {
  data: T;
  message?: string;
  status?: number;
}

// ── Get Base URL ──
const getBaseURL = (): string => {
  // In React Native, you can use environment variables or config
  // For development, you'll need to use your computer's IP address
  // For production, use your deployed API URL
  
  // You can set this in app.config.js or .env
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  // For development with Expo, use your computer's local IP
  // Example: 'http://192.168.1.100:5000'
  // Replace with your actual IP
  if (__DEV__) {
    return 'http://localhost:5000';
  }

  // Production URL
  return 'https://your-production-api.com';
};

// ── Get Auth Token ──
const getAuthToken = async (admin: boolean = false): Promise<string | null> => {
  try {
    const tokenKey = admin ? 'circle_admin_token' : 'circle_token';
    return await AsyncStorage.getItem(tokenKey);
  } catch (error) {
    console.warn('Failed to get auth token:', error);
    return null;
  }
};

// ── Get User ID ──
const getUserId = async (): Promise<string | null> => {
  try {
    const userString = await AsyncStorage.getItem('circle_user');
    if (userString) {
      const user = JSON.parse(userString);
      return user?.id ? String(user.id) : null;
    }
    return null;
  } catch (error) {
    console.warn('Failed to get user ID:', error);
    return null;
  }
};

// ── Main API Client ──
export async function apiClient<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const baseUrl = getBaseURL();
  const url = `${baseUrl}${endpoint}`;
  
  // ── Extract admin flag ──
  const { admin = false, body, ...restOptions } = options;
  
  // ── Headers ──
  const headers: Record<string, string> = {};
  
  // Set Content-Type
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  // ── Auth token ──
  const token = await getAuthToken(admin);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // ── User ID (for regular API calls) ──
  if (!admin) {
    const userId = await getUserId();
    if (userId) {
      headers['X-User-Id'] = userId;
    }
  }
  
  // ── Fetch options ──
  const fetchOptions: RequestInit = {
    ...restOptions,
    headers,
  };
  
  // ── Body ──
  if (body) {
    if (body instanceof FormData) {
      fetchOptions.body = body;
    } else {
      fetchOptions.body = JSON.stringify(body);
    }
  }
  
  try {
    const res = await fetch(url, fetchOptions);
    const contentType = res.headers.get('content-type') || '';
    
    // ── Handle non-JSON response ──
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(
        `Unexpected response from server (${contentType}).\n` +
        `Response preview: ${text.slice(0, 200)}`
      );
    }
    
    const data = await res.json();
    
    // ── Handle error response ──
    if (!res.ok) {
      throw new Error(data.message || data.error || 'API error');
    }
    
    return data as T;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ── Convenience methods ──
export const api = {
  get: <T = any>(endpoint: string, options?: ApiOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T = any>(endpoint: string, body?: any, options?: ApiOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'POST', body }),
  
  put: <T = any>(endpoint: string, body?: any, options?: ApiOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
  
  patch: <T = any>(endpoint: string, body?: any, options?: ApiOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
  
  delete: <T = any>(endpoint: string, options?: ApiOptions) => 
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};