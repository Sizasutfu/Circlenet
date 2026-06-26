// src/contexts/SearchContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

const SearchContext = createContext();

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('posts'); // 'posts' | 'people' | 'groups'
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState([]);
  const abortControllerRef = useRef(null);

  // ── Search ──
  const search = useCallback(async (q, searchType = type, pageNum = 1, append = false) => {
    if (!q || q.length < 2) {
      setResults([]);
      setHasMore(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);

    try {
      const res = await apiClient(
        `/api/search?q=${encodeURIComponent(q)}&type=${searchType}&page=${pageNum}&limit=20`,
        { signal: abortControllerRef.current.signal }
      );
      const data = res.data || [];
      const hasMoreData = res.meta?.hasMore || data.length === 20;

      setResults((prev) => (append ? [...prev, ...data] : data));
      setHasMore(hasMoreData);
      setPage(pageNum + 1);
      setQuery(q);
      setType(searchType);

      // Save to history
      if (q.length >= 2) {
        setHistory((prev) => {
          const filtered = prev.filter((h) => h.query !== q || h.tab !== searchType);
          return [{ query: q, tab: searchType, searched_at: new Date().toISOString() }, ...filtered].slice(0, 20);
        });
        // Optionally save to server
        try {
          await apiClient('/api/search/history', {
            method: 'POST',
            body: JSON.stringify({ query: q, tab: searchType }),
          });
        } catch (_) {}
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      search(query, type, page, true);
    }
  }, [hasMore, loading, query, type, page, search]);

  // ── Clear results ──
  const clearResults = useCallback(() => {
    setResults([]);
    setHasMore(false);
    setPage(1);
  }, []);

  // ── Load history from server ──
  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient('/api/search/history');
      setHistory(res.data || []);
    } catch (_) {}
  }, []);

  // ── Delete history entry ──
  const deleteHistoryEntry = useCallback(async (id, q, tab) => {
    try {
      if (id) await apiClient(`/api/search/history/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((h) => !(h.query === q && h.tab === tab)));
    } catch (_) {}
  }, []);

  // ── Clear all history ──
  const clearHistory = useCallback(async () => {
    try {
      await apiClient('/api/search/history', { method: 'DELETE' });
      setHistory([]);
    } catch (_) {}
  }, []);

  const value = {
    query,
    type,
    results,
    loading,
    hasMore,
    history,
    search,
    loadMore,
    clearResults,
    loadHistory,
    deleteHistoryEntry,
    clearHistory,
    setType,
  };

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}