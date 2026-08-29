// src/lib/auth.js
'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from './api';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // ── Load session from localStorage ──
  useEffect(() => {
    const loadUser = () => {
      try {
        const stored = localStorage.getItem('circle_user');
        if (stored) {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        }
      } catch (err) {
        console.error('Failed to load auth user', err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();

    const handleStorage = (e) => {
      if (e.key === 'circle_user') {
        try {
          setUser(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (_) { setUser(null); }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // ── Internal: set user and persist ──
  const setCurrentUser = useCallback((userData, token) => {
    if (token) localStorage.setItem('circle_token', token);
    if (userData) {
      // Strip the token out of the stored user object — it's persisted
      // separately under circle_token, and doesn't belong in circle_user.
      const { token: _discard, ...safeUserData } = userData;
      localStorage.setItem('circle_user', JSON.stringify(safeUserData));
      setUser(safeUserData);
    } else {
      localStorage.removeItem('circle_user');
      setUser(null);
    }
  }, []);

  // ── Login with email/password ──
  const login = useCallback(async (email, password) => {
    const res = await apiClient('/api/users/login', {
      method: 'POST',
      body: { email, password }, // ✅ plain object
    });
    // The backend nests the token inside res.data (alongside the user
    // fields), not at the top level of the response — so it must be read
    // from res.data.token, not res.token.
    const token = res.data?.token;
    setCurrentUser(res.data, token);
    return res;
  }, [setCurrentUser]);

  // ── Register with email ──
  const register = useCallback(async (name, email, password, phone) => {
    const res = await apiClient('/api/users/register', {
      method: 'POST',
      body: { name, email, password, phone: phone || undefined }, // ✅ plain object
    });
    return res.data;
  }, []);

  // ── Send email verification code ──
  const sendEmailVerification = useCallback(async (email) => {
    await apiClient('/api/users/email/send-verification', {
      method: 'POST',
      body: { email }, // ✅ plain object
    });
  }, []);

  // ── Verify email with OTP ──
  const verifyEmail = useCallback(async (email, code) => {
    const res = await apiClient('/api/users/email/verify', {
      method: 'POST',
      body: { email, code }, // ✅ plain object
    });
    const token = res.data?.token;
    if (res.data) setCurrentUser(res.data, token);
    return res;
  }, [setCurrentUser]);

  // ── Send phone OTP for login ──
  const sendPhoneOtp = useCallback(async (phone) => {
    await apiClient('/api/auth/phone/send-otp', {
      method: 'POST',
      body: { phone }, // ✅ plain object
    });
  }, []);

  // ── Verify phone OTP for login ──
  const verifyPhoneOtp = useCallback(async (phone, code) => {
    const res = await apiClient('/api/auth/phone/verify-otp', {
      method: 'POST',
      body: { phone, code }, // ✅ plain object
    });
    const token = res.data?.token;
    setCurrentUser(res.data, token);
    return res;
  }, [setCurrentUser]);

  // ── Register with phone (send OTP) ──
  const registerPhoneSendOtp = useCallback(async (phone, name) => {
    await apiClient('/api/auth/phone/register/send-otp', {
      method: 'POST',
      body: { phone, name }, // ✅ plain object
    });
  }, []);

  // ── Verify phone OTP for registration ──
  const registerPhoneVerifyOtp = useCallback(async (phone, code, name) => {
    const res = await apiClient('/api/auth/phone/register/verify-otp', {
      method: 'POST',
      body: { phone, code, name }, // ✅ plain object
    });
    const token = res.data?.token;
    setCurrentUser(res.data, token);
    return res;
  }, [setCurrentUser]);

  // ── Request password reset ──
  const requestPasswordReset = useCallback(async (email) => {
    await apiClient('/api/users/reset-password', {
      method: 'POST',
      body: { email }, // ✅ plain object
    });
  }, []);

  // ── Confirm password reset ──
  const confirmPasswordReset = useCallback(async (token, password) => {
    await apiClient('/api/users/reset-password/confirm', {
      method: 'POST',
      body: { token, password }, // ✅ plain object
    });
  }, []);

  // ── Logout ──
  const logout = useCallback(() => {
    localStorage.removeItem('circle_user');
    localStorage.removeItem('circle_token');
    setUser(null);
    router.push('/');
  }, [router]);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    sendEmailVerification,
    verifyEmail,
    sendPhoneOtp,
    verifyPhoneOtp,
    registerPhoneSendOtp,
    registerPhoneVerifyOtp,
    requestPasswordReset,
    confirmPasswordReset,
    setCurrentUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ── Synchronous helpers ──
export function isAuthenticated() {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('circle_user'));
}

export function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const destination = `/login?redirect=${encodeURIComponent(window.location.href)}`;
    window.location.href = destination;
  }
}