// src/lib/api.js
const getBaseURL = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5000';   // force HTTP
  }
  // production (adjust as needed)
  return 'https://sizabeats:5000';
};

export async function apiClient(endpoint, options = {}) {
  const url = `${getBaseURL()}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('circle_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
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