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
      const msgs = res.messages || [];
      setMessages(prev => cursorParam ? [...prev, ...msgs] : msgs);
      setCursor(res.nextCursor || null);
      setHasMore(res.hasMore || false);
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
      setSettings(res);
    } catch (err) {
      console.error('Failed to fetch whisper settings:', err);
      // Fallback to default
      setSettings({ enabled: false, link_slug: '' });
    }
  }, [user]);

  // ── Update settings (enable/disable) ──
  const updateSettings = useCallback(async (enabled) => {
    try {
      const res = await apiClient('/api/whisper/settings', {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      setSettings(prev => ({ ...prev, enabled }));
      return res;
    } catch (err) {
      console.error('Whisper settings update failed:', err);
      throw err; // rethrow so the UI can handle it
    }
  }, []);

  // ── Post whisper to feed (with card image) ──
  const postWhisper = useCallback(async (whisperId, replyText) => {
    if (!user) throw new Error('Not authenticated');

    // 1. Generate the card image
    const messageObj = messages.find(m => m.id === whisperId);
    if (!messageObj) throw new Error('Whisper message not found');

    // Dynamically import the card generator to avoid client‑side issues
    const { generateWhisperCard } = await import('@/lib/whisperCard');
    const canvas = await generateWhisperCard(messageObj.message, user.username);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const imageFile = new File([blob], `whisper-${whisperId}.png`, { type: 'image/png' });

    // 2. Build FormData
    const formData = new FormData();
    formData.append('text', replyText);
    formData.append('image', imageFile);

    // 3. Send to API
    try {
      const res = await apiClient(`/api/whisper/${whisperId}/post`, {
        method: 'POST',
        body: formData,
      });
      // Mark message as posted locally
      setMessages(prev => prev.map(m =>
        m.id === whisperId ? { ...m, posted: true } : m
      ));
      return res;
    } catch (err) {
      console.error('Failed to post whisper:', err);
      throw err;
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