// src/lib/adminApi.js
export async function adminApi(endpoint, options = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('circle_admin_token') : null;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  const url = `${base}/api${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'API error');
  return data;
}