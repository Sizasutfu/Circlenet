// src/lib/auth.js
'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('circle_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('circle_user', JSON.stringify(userData));
    localStorage.setItem('circle_token', token);
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

// Helper to redirect to login page, preserving the current URL
export function redirectToLogin() {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('loginRedirect', window.location.href);
    window.location.href = '/login'; // Change to 'https://www.circlenet.social/login' if external
  }
}