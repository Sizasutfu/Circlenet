// src/lib/api.js
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }
  return ' http://localhost:5000';
};

export async function apiClient(endpoint, options = {}) {
  const url = `${getBaseURL()}${endpoint}`;
  const headers = {};

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

  const fetchOptions = { ...options, headers };
  if (!(options.body instanceof FormData) && options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const contentType = res.headers.get('content-type') || '';

  // ── Check if the response is JSON ──
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