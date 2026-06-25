// src/lib/api.js
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }
  return 'http://localhost:5000';
};

export async function apiClient(endpoint, options = {}) {
  const url = `${getBaseURL()}${endpoint}`;
  const headers = {};

  // Only set Content-Type to JSON if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('circle_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const userString = localStorage.getItem('circle_user');
    if (userString) {
      try {
        const user = JSON.parse(userString);
        if (user?.id) headers['X-User-Id'] = String(user.id);
      } catch (e) {
        console.warn('Failed to parse circle_user for API auth header', e);
      }
    }
  } else {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('circle_token')?.value;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {}
  }

  // ── Build the request body ──
  let body = options.body;
  const fetchOptions = { ...options, headers };

  if (body instanceof FormData) {
    // Let the browser set Content-Type with boundary
    fetchOptions.body = body;
    // Remove the Content-Type header we set earlier for FormData
    delete headers['Content-Type'];
  } else if (body && typeof body === 'object' && !(body instanceof FormData)) {
    // Plain object or array → stringify as JSON
    fetchOptions.body = JSON.stringify(body);
  } else if (body && typeof body === 'string') {
    // Already a string – pass as-is (e.g., for raw text)
    fetchOptions.body = body;
  } else {
    // undefined or null → no body
    // leave as is
  }

  try {
    const res = await fetch(url, fetchOptions);
    const contentType = res.headers.get('content-type') || '';

    // Check if response is JSON
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(
        `Unexpected response from server (${contentType || 'no content-type'}).\n` +
        `Response preview: ${text.slice(0, 200)}`
      );
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API error');
    return data;
  } catch (err) {
    // Network errors (ECONNREFUSED, etc.)
    if (err.message.includes('fetch') || err.message.includes('connect')) {
      throw new Error(
        `Could not connect to backend.\n` +
        `Make sure the server is running on ${getBaseURL()} and accessible.\n` +
        `Original error: ${err.message}`
      );
    }
    throw err;
  }
}