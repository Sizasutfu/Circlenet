// src/lib/api.js
const getBaseURL = () => {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  return 'http://localhost:5000';
};

export async function apiClient(endpoint, options = {}) {
  const url = `${getBaseURL()}${endpoint}`;
  const headers = {};

  // ── Extract admin flag ──
  const { admin = false, ...restOptions } = options;

  // ── Set Content-Type header ──
  // Only set for methods that have a body (POST, PUT, PATCH, DELETE)
  const method = (restOptions.method || 'GET').toUpperCase();
  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  
  if (hasBody && !(restOptions.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // ── Auth headers ──
  if (typeof window !== 'undefined') {
    // Use admin token if flagged, otherwise regular token
    const tokenKey = admin ? 'circle_admin_token' : 'circle_token';
    const token = localStorage.getItem(tokenKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // For regular API calls, include user ID in header
    if (!admin) {
      const userString = localStorage.getItem('circle_user');
      if (userString) {
        try {
          const user = JSON.parse(userString);
          if (user?.id) headers['X-User-Id'] = String(user.id);
        } catch (e) {
          console.warn('Failed to parse circle_user for API auth header', e);
        }
      }
    }
  } else {
    // Server-side – use cookies
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const tokenKey = admin ? 'circle_admin_token' : 'circle_token';
      const token = cookieStore.get(tokenKey)?.value;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      // ignore
    }
  }

  // ── Build fetch options ──
  const fetchOptions = { ...restOptions, headers };
  
  // ── Handle body for methods that support it ──
  if (hasBody && restOptions.body && !(restOptions.body instanceof FormData)) {
    fetchOptions.body = JSON.stringify(restOptions.body);
  } else if (hasBody && restOptions.body instanceof FormData) {
    // FormData will be sent as-is
    fetchOptions.body = restOptions.body;
  }

  const res = await fetch(url, fetchOptions);
  const contentType = res.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await res.text();
    throw new Error(
      `Unexpected response from server (${contentType}).\n` +
      `Response preview: ${text.slice(0, 200)}`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
}