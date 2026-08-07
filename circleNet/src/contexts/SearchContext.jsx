// src/contexts/SearchContext.jsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

const SearchContext = createContext();

export function SearchProvider({ children }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState([]);
  const abortControllerRef = useRef(null);
  const [initialized, setInitialized] = useState(false);

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
        const response = await apiClient(url, { signal: controller.signal });

        let data = [];
        let hasMoreData = false;

        if (response && typeof response === 'object') {
          if (response.data && Array.isArray(response.data)) {
            data = response.data;
          } else if (Array.isArray(response)) {
            data = response;
          }
          
          if (response.meta && typeof response.meta.hasMore !== 'undefined') {
            hasMoreData = response.meta.hasMore;
          } else if (response.hasMore !== undefined) {
            hasMoreData = response.hasMore;
          } else {
            hasMoreData = data.length === 20;
          }
        }

        const processedData = data.map(item => {
          if (item._type) return item;
          
          if (item.text !== undefined && item.userId !== undefined) {
            return { ...item, _type: 'post' };
          }
          if (item.topic !== undefined || item.displayName !== undefined) {
            return { ...item, _type: 'group' };
          }
          if (item.email !== undefined || item.username !== undefined) {
            return { ...item, _type: 'user' };
          }
          return { ...item, _type: 'post' };
        });

        setResults((prev) => (append ? [...prev, ...processedData] : processedData));
        setHasMore(hasMoreData);
        setPage(pageNum + 1);
        setQuery(q);
        setType(searchType);

        // ── Save to history ──
        if (q.length >= 2 && !append) {
          try {
            const historyResponse = await apiClient('/api/search/history', {
              method: 'POST',
              body: JSON.stringify({ query: q, tab: searchType }),
            });
            // Update history with the response
            if (historyResponse && historyResponse.data) {
              setHistory(historyResponse.data);
            }
          } catch (err) {
            console.warn('Failed to save search history:', err.message);
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Search error:', err);
        setResults([]);
        setHasMore(false);
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

  // ── Load history ──
  const loadHistory = useCallback(async () => {
    try {
      const response = await apiClient('/api/search/history');
      
      let historyData = [];
      if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          historyData = response.data;
        } else if (Array.isArray(response)) {
          historyData = response;
        }
      }
      
      setHistory(historyData);
    } catch (err) {
      console.warn('Failed to load search history:', err.message);
      setHistory([]);
    }
  }, []);

  // ── Delete history entry ──
  const deleteHistoryEntry = useCallback(async (id, q, tab) => {
    try {
      const response = await apiClient(`/api/search/history/${id}`, { method: 'DELETE' });
      
      // Update history with the response
      if (response && response.data) {
        setHistory(response.data);
      } else {
        // Fallback: filter locally
        setHistory((prev) => prev.filter((h) => !(h.query === q && h.tab === tab)));
      }
    } catch (err) {
      console.warn('Failed to delete history entry:', err.message);
      // Still remove from local state
      setHistory((prev) => prev.filter((h) => !(h.query === q && h.tab === tab)));
    }
  }, []);

  // ── Clear all history ──
  const clearHistory = useCallback(async () => {
    try {
      await apiClient('/api/search/history', { method: 'DELETE' });
      setHistory([]);
    } catch (err) {
      console.warn('Failed to clear search history:', err.message);
      setHistory([]);
    }
  }, []);

  // ── Load history on mount ──
  useEffect(() => {
    if (!initialized) {
      loadHistory();
      setInitialized(true);
    }
  }, [loadHistory, initialized]);

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