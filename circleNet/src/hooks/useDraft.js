// hooks/useDraft.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

const DRAFT_KEY = 'compose_draft_';

export function useDraft(mode) {
  const { user } = useAuth();
  const userId = user?.id || 'guest';
  const key = `${DRAFT_KEY}${userId}_${mode}`;

  const [draft, setDraft] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const imageDb = useRef(null);

  // Open IndexedDB for images
  useEffect(() => {
    const request = indexedDB.open('ComposeDrafts', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      imageDb.current = e.target.result;
      // Load draft from localStorage and images from IndexedDB
      loadDraft();
    };
    request.onerror = () => {
      // Fallback: load from localStorage only
      loadDraft();
    };
  }, [key]);

  const loadDraft = () => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Load image from IndexedDB if needed
        if (parsed.imageData && imageDb.current) {
          const tx = imageDb.current.transaction('images', 'readonly');
          const store = tx.objectStore('images');
          const request = store.get(key);
          request.onsuccess = () => {
            if (request.result) {
              parsed.imageData = request.result.data; // base64
            }
            setDraft(parsed);
            setLoaded(true);
          };
          request.onerror = () => {
            setDraft(parsed);
            setLoaded(true);
          };
        } else {
          setDraft(parsed);
          setLoaded(true);
        }
      } else {
        setDraft(null);
        setLoaded(true);
      }
    } catch (e) {
      setDraft(null);
      setLoaded(true);
    }
  };

  const saveDraft = useCallback((data) => {
    if (!user) return; // don't save drafts for guests? We can still save but keyed by guest.
    // Debounce
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const { imageData, ...rest } = data;
        // Save text fields to localStorage
        localStorage.setItem(key, JSON.stringify(rest));
        // Save image to IndexedDB if present
        if (imageData && imageDb.current) {
          const tx = imageDb.current.transaction('images', 'readwrite');
          const store = tx.objectStore('images');
          store.put({ id: key, data: imageData });
        }
      } catch (e) {
        console.warn('Draft save failed:', e);
      }
    }, 500);
  }, [key, user]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    if (imageDb.current) {
      const tx = imageDb.current.transaction('images', 'readwrite');
      const store = tx.objectStore('images');
      store.delete(key);
    }
    setDraft(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, [key]);

  return { draft, loaded, saveDraft, clearDraft };
}