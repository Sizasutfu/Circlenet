// src/contexts/PushContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BDrQXFG6fUBbN110-JFtCCpHYAcHYvIdoExS1tolzULYEOBI1Ky2d-Rdsk-q071dk1DE7o_n2sje_xvxLUOFPWQ';

const PushContext = createContext();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushProvider({ children }) {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preferences, setPreferences] = useState({
    likes: true,
    comments: true,
    reposts: true,
    new_post: true,
    profile_pic: true,
    follows: true,
    mentions: true,
  });

  const swRegistrationRef = useRef(null);

  // ── Check support & sync state ──
  const syncPushState = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('PushManager' in window)) {
      setIsSupported(false);
      setLoading(false);
      return;
    }
    setIsSupported(true);
    setPermission(Notification.permission || 'default');

    if (Notification.permission === 'denied') {
      setIsSubscribed(false);
      setLoading(false);
      return;
    }

    try {
      // Wait for service worker registration
      const reg = await navigator.serviceWorker.ready;
      swRegistrationRef.current = reg;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.warn('Push sync error:', err);
      setError(err.message);
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncPushState();
    // Re-sync when the user changes or service worker state changes
    const handleSWUpdate = () => syncPushState();
    navigator.serviceWorker?.addEventListener('controllerchange', handleSWUpdate);
    return () => {
      navigator.serviceWorker?.removeEventListener('controllerchange', handleSWUpdate);
    };
  }, [syncPushState]);

  // ── Subscribe ──
  const subscribePush = useCallback(async () => {
    if (!swRegistrationRef.current) {
      // Try to get registration again
      const reg = await navigator.serviceWorker.ready;
      swRegistrationRef.current = reg;
    }
    try {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await swRegistrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subData = subscription.toJSON();
      await apiClient('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subData,
          preferences,
          userId: user?.id,
        }),
      });

      setIsSubscribed(true);
      return subscription;
    } catch (err) {
      console.error('Push subscription failed:', err);
      throw err;
    }
  }, [user, preferences]);

  // ── Unsubscribe ──
  const unsubscribePush = useCallback(async () => {
    if (!swRegistrationRef.current) return;
    const sub = await swRegistrationRef.current.pushManager.getSubscription();
    if (!sub) return;
    try {
      await apiClient('/api/push/unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      throw err;
    }
  }, []);

  // ── Toggle push ──
  const togglePush = useCallback(async (enabled) => {
    if (!isSupported) {
      throw new Error('Push not supported');
    }
    if (enabled) {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') {
          throw new Error(perm === 'denied' ? 'Permission denied' : 'Permission dismissed');
        }
      }
      await subscribePush();
    } else {
      await unsubscribePush();
    }
  }, [isSupported, subscribePush, unsubscribePush]);

  // ── Save preferences ──
  const savePreferences = useCallback(async (newPrefs) => {
    setPreferences(newPrefs);
    if (isSubscribed) {
      try {
        const sub = await swRegistrationRef.current?.pushManager?.getSubscription();
        if (sub) {
          await apiClient('/api/push/preferences', {
            method: 'POST',
            body: JSON.stringify({
              endpoint: sub.endpoint,
              preferences: newPrefs,
            }),
          });
        }
      } catch (_) {}
    }
  }, [isSubscribed]);

  const updatePreference = useCallback(async (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    await savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  const value = {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    preferences,
    togglePush,
    updatePreference,
    syncPushState,
  };

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush() {
  const context = useContext(PushContext);
  if (!context) {
    throw new Error('usePush must be used within a PushProvider');
  }
  return context;
}