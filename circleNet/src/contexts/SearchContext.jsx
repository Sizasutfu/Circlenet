// src/contexts/SearchContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

const SearchContext = createContext();

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('posts');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState([]);
  const abortControllerRef = useRef(null);

  // ── Search ──
  const search = useCallback(
    async (q, searchType = type, pageNum = 1, append = false) => {
      if (!q || q.length < 2) {
        setResults([]);
        setHasMore(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);

      const url = `/api/search?q=${encodeURIComponent(q)}&type=${searchType}&page=${pageNum}&limit=20`;

      try {
        const res = await apiClient(url, { signal: controller.signal });

        // ── DEBUG: log the raw response ──
        console.log('🔍 Raw search response:', res);

        // ── Robust data extraction ──
        let data = [];
        const typeMap = { posts: 'posts', people: 'people', groups: 'groups' };
        const key = typeMap[searchType] || 'results';

        // Try multiple possible response shapes:
        if (Array.isArray(res)) {
          data = res;
        } else if (res.data && Array.isArray(res.data)) {
          data = res.data;
        } else if (res.results && Array.isArray(res.results)) {
          data = res.results;
        } else if (res.data && res.data.results && Array.isArray(res.data.results)) {
          data = res.data.results;
        } else if (res.data && res.data[key] && Array.isArray(res.data[key])) {
          data = res.data[key];
        } else if (res[key] && Array.isArray(res[key])) {
          data = res[key];
        } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        } else if (res.items && Array.isArray(res.items)) {
          data = res.items;
        } else if (res.data && res.data.items && Array.isArray(res.data.items)) {
          data = res.data.items;
        } else {
          // Last resort: try to find any array in the response
          for (const [k, v] of Object.entries(res)) {
            if (Array.isArray(v)) {
              data = v;
              break;
            }
            if (res.data && Array.isArray(res.data[k])) {
              data = res.data[k];
              break;
            }
          }
        }

        // If data is still empty, try to use res.data if it's an object with numeric keys
        if (!data.length && res.data && typeof res.data === 'object') {
          const values = Object.values(res.data);
          if (values.length && values.every(v => typeof v === 'object')) {
            data = values;
          }
        }

        console.log('📦 Extracted data:', data);

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
            return [
              { query: q, tab: searchType, searched_at: new Date().toISOString() },
              ...filtered,
            ].slice(0, 20);
          });
          try {
            await apiClient('/api/search/history', {
              method: 'POST',
              body: JSON.stringify({ query: q, tab: searchType }),
            });
          } catch (_) {}
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('❌ Search error:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [type]
  );

  // ── Load more ──
  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      search(query, type, page, true);
    }
  }, [hasMore, loading, query, type, page, search]);

  const clearResults = useCallback(() => {
    setResults([]);
    setHasMore(false);
    setPage(1);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient('/api/search/history');
      setHistory(res.data || []);
    } catch (_) {}
  }, []);

  const deleteHistoryEntry = useCallback(async (id, q, tab) => {
    try {
      if (id) await apiClient(`/api/search/history/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((h) => !(h.query === q && h.tab === tab)));
    } catch (_) {}
  }, []);

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