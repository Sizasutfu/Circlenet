// src/lib/api.js
const getBaseURL = () => {
  // In production, prefer the environment variable. If it's not set,
  // fall back to same-origin so client requests go to the current host
  // (e.g. https://www.circlenet.social) instead of an invalid URL.
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }
  // Development fallback
  return 'http://localhost:5000';
};

export async function apiClient(endpoint, options = {}) {
  const url = `${getBaseURL()}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

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

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
}