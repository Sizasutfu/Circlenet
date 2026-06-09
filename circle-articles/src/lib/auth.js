// src/lib/auth.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = () => {
      try {
        const stored = localStorage.getItem('circle_user');
        if (stored) setUser(JSON.parse(stored));
        else setUser(null);
      } catch (err) {
        console.error('Failed to load auth user', err);
        setUser(null);
      }
    };

    loadUser();

    const handleStorage = (event) => {
      if (event.key === 'circle_user') {
        loadUser();
      }
    };

    const handleFocus = () => {
      loadUser();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('circle_user', JSON.stringify(userData));
    if (token) {
      localStorage.setItem('circle_token', token);
    } else {
      localStorage.removeItem('circle_token');
    }
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('circle_user');
    localStorage.removeItem('circle_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('circle_user'));
}

const LOCAL_LOGIN_PATH = process.env.NEXT_PUBLIC_LOGIN_URL || '/login';

// Helper to redirect to the local login page, preserving the current URL
export function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const destination = `${LOCAL_LOGIN_PATH}?redirect=${encodeURIComponent(window.location.href)}`;
    window.location.href = destination;
  }
}