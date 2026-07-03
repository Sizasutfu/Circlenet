// src/contexts/WhisperContext.jsx
'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

const WhisperContext = createContext();

export function WhisperProvider({ children }) {
  const { user } = useAuth();

  // ── State ──
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ enabled: false, link_slug: '' });

  // ── Fetch inbox ──
  const fetchInbox = useCallback(async (cursorParam = null) => {
    if (!user) return;
    setLoading(true);
    try {
      const url = cursorParam ? `/api/whisper/inbox?cursor=${cursorParam}` : '/api/whisper/inbox';
      const res = await apiClient(url);
      const msgs = res.data?.messages || res.messages || [];
      setMessages(prev => cursorParam ? [...prev, ...msgs] : msgs);
      setCursor(res.data?.nextCursor || res.nextCursor || null);
      setHasMore(res.data?.hasMore || res.hasMore || false);
    } catch (err) {
      console.error('Failed to fetch whisper inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Delete message ──
  const deleteMessage = useCallback(async (id) => {
    await apiClient(`/api/whisper/${id}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // ── Report message ──
  const reportMessage = useCallback(async (id) => {
    await apiClient(`/api/whisper/${id}/report`, { method: 'POST' });
  }, []);

  // ── Fetch settings ──
  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiClient('/api/whisper/settings');
      // Handle both nested and flat responses
      const data = res.data || res;
      setSettings({
        enabled: !!data.enabled,
        link_slug: data.link_slug || '',
      });
    } catch (err) {
      console.error('Failed to fetch whisper settings:', err);
      setSettings({ enabled: false, link_slug: '' });
    }
  }, [user]);

  // ── Update settings ──
  const updateSettings = useCallback(async (enabled) => {
    try {
      const res = await apiClient('/api/whisper/settings', {
        method: 'PATCH',
        body: { enabled },
      });
      const data = res.data || res;
      setSettings(prev => ({ ...prev, enabled: !!data.enabled }));
      return res;
    } catch (err) {
      console.error('Whisper settings update failed:', err);
      throw err;
    }
  }, []);

  // ── Regenerate slug ──
  const regenerateSlug = useCallback(async () => {
    try {
      const res = await apiClient('/api/whisper/settings/regenerate-slug', {
        method: 'POST',
      });
      // Extract link_slug from response (flat or nested)
      const linkSlug = res.link_slug || res.data?.link_slug;
      if (linkSlug) {
        setSettings(prev => ({ ...prev, link_slug: linkSlug }));
      }
      return linkSlug;
    } catch (err) {
      console.error('Failed to regenerate whisper slug:', err);
      throw err;
    }
  }, []);

  // ── Post whisper to feed ──
  const postWhisper = useCallback(async (whisperId, replyText) => {
    if (!user) throw new Error('Not authenticated');

    const messageObj = messages.find(m => m.id === whisperId);
    if (!messageObj) throw new Error('Whisper message not found');

    try {
      const { generateWhisperCard } = await import('@/lib/whisperCard');
      const canvas = await generateWhisperCard(messageObj.message, user.username);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const imageFile = new File([blob], `whisper-${whisperId}.png`, { type: 'image/png' });

      const formData = new FormData();
      formData.append('text', replyText);
      formData.append('image', imageFile);

      const res = await apiClient(`/api/whisper/${whisperId}/post`, {
        method: 'POST',
        body: formData,
      });

      setMessages(prev => prev.map(m =>
        m.id === whisperId ? { ...m, posted: true } : m
      ));
      return res;
    } catch (err) {
      console.error('Whisper post error:', err);
      throw new Error(err.message || 'Failed to post whisper. Please try again.');
    }
  }, [user, messages]);

  const value = {
    messages,
    cursor,
    hasMore,
    loading,
    settings,
    fetchInbox,
    deleteMessage,
    reportMessage,
    fetchSettings,
    updateSettings,
    regenerateSlug,
    postWhisper,
  };

  return <WhisperContext.Provider value={value}>{children}</WhisperContext.Provider>;
}

export function useWhisper() {
  const context = useContext(WhisperContext);
  if (!context) {
    throw new Error('useWhisper must be used within a WhisperProvider');
  }
  return context;
}