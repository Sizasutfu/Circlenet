// src/app/search/SearchClient.jsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearch } from '@/contexts/SearchContext';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import GroupCard from '@/components/groups/GroupCard';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import VerificationBadge from '@/components/ui/VerificationBadge';
import { resolveMediaUrl } from '@/lib/url';
import { apiClient } from '@/lib/api';
import QuoteModal from '@/components/ui/QuoteModal';

function highlight(text, q) {
  if (!text) return '';
  const safe = text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m);
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark class="hl">$1</mark>');
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// ─── Toast component ──────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColor = type === 'error' ? 'var(--color-rose)' : 'var(--color-green)';
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium"
      style={{ background: bgColor }}
    >
      {message}
    </div>
  );
}

// ─── Skeleton components ──────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-[var(--color-surface)] rounded" />
            <div className="h-3 w-16 bg-[var(--color-surface)] rounded" />
            <div className="h-3 w-12 bg-[var(--color-surface)] rounded" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-[var(--color-surface)] rounded" />
            <div className="h-3 w-5/6 bg-[var(--color-surface)] rounded" />
            <div className="h-3 w-3/4 bg-[var(--color-surface)] rounded" />
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
            <div className="h-4 w-12 bg-[var(--color-surface)] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PeopleSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
      <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
        <div className="h-3 w-1/2 bg-[var(--color-surface)] rounded" />
        <div className="h-3 w-1/4 bg-[var(--color-surface)] rounded" />
      </div>
      <div className="w-16 h-8 bg-[var(--color-surface)] rounded-full" />
    </div>
  );
}

function GroupSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-[var(--color-surface)] flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
        <div className="h-3 w-1/2 bg-[var(--color-surface)] rounded" />
      </div>
      <div className="w-16 h-8 bg-[var(--color-surface)] rounded-full" />
    </div>
  );
}

// ─── SVG icons ─────────────────────────────────────────────────────────
const PostIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GroupIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

// ─── Autocomplete dropdown ────────────────────────────────────────────
function AutocompleteDropdown({ suggestions, query, onSelect, loading, activeTab }) {
  const router = useRouter();
  
  if (!query || query.length < 2) return null;
  if (loading) {
    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-2 z-50">
        <div className="flex items-center gap-2 p-2">
          <div className="animate-spin h-4 w-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
          <span className="text-sm text-[var(--color-txt3)]">Loading suggestions...</span>
        </div>
      </div>
    );
  }
  if (!suggestions.length) {
    return (
      <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-3 z-50">
        <p className="text-sm text-[var(--color-txt2)]">No suggestions found</p>
      </div>
    );
  }

  const grouped = suggestions.reduce((acc, item) => {
    const type = item._type || 'post';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  const typeLabels = {
    post: 'Posts',
    user: 'Users',
    group: 'Groups',
  };

  const typeIcons = {
    post: <PostIcon />,
    user: <UserIcon />,
    group: <GroupIcon />,
  };

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-2 z-50 max-h-96 overflow-y-auto">
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="mb-2 last:mb-0">
          <div className="text-xs font-semibold text-[var(--color-txt3)] uppercase tracking-wider px-2 py-1">
            {typeLabels[type] || type}
          </div>
          {items.map((item) => (
            <div
              key={`${type}-${item.id}`}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-surface)] transition cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <div className="text-[var(--color-txt2)] flex-shrink-0">
                {typeIcons[type] || typeIcons.post}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--color-txt)] truncate">
                  {type === 'post' && (
                    <span dangerouslySetInnerHTML={{ __html: highlight(item.preview || item.text || '', query) }} />
                  )}
                  {type === 'user' && (
                    <span dangerouslySetInnerHTML={{ __html: highlight(item.name, query) }} />
                  )}
                  {type === 'group' && (
                    <span dangerouslySetInnerHTML={{ __html: highlight(item.displayName || item.topic, query) }} />
                  )}
                </div>
                <div className="text-xs text-[var(--color-txt2)] truncate">
                  {type === 'post' && `by ${item.author || item.user?.name || 'Unknown'}`}
                  {type === 'user' && `@${item.username || 'user'}`}
                  {type === 'group' && `${item.memberCount || 0} members`}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="border-t border-[var(--color-border)] pt-2 mt-2">
        <button
          onClick={() => {
            const q = query;
            const url = `/search?q=${encodeURIComponent(q)}&type=${activeTab || 'all'}`;
            router.push(url);
          }}
          className="w-full text-center text-sm text-[var(--color-accent)] hover:underline"
        >
          See all results for "{query}"
        </button>
      </div>
    </div>
  );
}

// ─── People Card Component ────────────────────────────────────────────
function PeopleCard({ user: u, query, currentUser, onFollowUpdate }) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(u.isFollowing || false);
  const [isLoading, setIsLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(u.followerCount || 0);
  
  const avatarUrl = resolveMediaUrl(u.picture);
  const isVerified = u.verified === 1 || u.verified === true;

  const handleProfileClick = (e) => {
    e.stopPropagation();
    if (u.username) {
      router.push(`/profile/${u.username}`);
    } else {
      router.push(`/profile?userId=${u.id}`);
    }
  };

  const handleFollowClick = async (e) => {
    e.stopPropagation();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    
    setIsLoading(true);
    try {
      // Use the same endpoint pattern as ProfileClient
      const method = isFollowing ? 'DELETE' : 'POST';
      const endpoint = isFollowing ? `/api/unfollow/${u.id}` : `/api/follow/${u.id}`;
      
      const response = await apiClient(endpoint, { method });
      
      const newFollowState = !isFollowing;
      setIsFollowing(newFollowState);
      setFollowerCount(prev => newFollowState ? prev + 1 : prev - 1);
      
      if (onFollowUpdate) {
        onFollowUpdate(u.id, newFollowState);
      }
    } catch (err) {
      console.error('Failed to update follow:', err);
      // Show error toast via event
      const toastEvent = new CustomEvent('showToast', { 
        detail: { message: 'Failed to update follow status.', type: 'error' } 
      });
      window.dispatchEvent(toastEvent);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition">
      <div 
        className="flex-shrink-0 cursor-pointer"
        onClick={handleProfileClick}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={u.name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="w-10 h-10" />
        )}
      </div>
      <div 
        className="flex-1 min-w-0 cursor-pointer"
        onClick={handleProfileClick}
      >
        <div className="font-semibold text-[var(--color-txt)] flex items-center gap-1">
          <span dangerouslySetInnerHTML={{ __html: highlight(u.name, query) }} />
          {isVerified && <VerificationBadge size="w-3.5 h-3.5" />}
        </div>
        <div className="text-sm text-[var(--color-txt2)]" dangerouslySetInnerHTML={{ __html: highlight(u.username || '', query) }} />
        <div className="text-xs text-[var(--color-txt3)]">{u.postCount || 0} posts · {followerCount} followers</div>
      </div>
      {currentUser && currentUser.id !== u.id && (
        <button
          onClick={handleFollowClick}
          disabled={isLoading}
          className={`px-4 py-1.5 text-sm rounded-full transition ${
            isFollowing
              ? 'bg-[var(--color-surface)] text-[var(--color-txt)] border border-[var(--color-border)] hover:bg-[var(--color-rose-bg)] hover:text-[var(--color-rose)] hover:border-[var(--color-rose)]'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────
export default function SearchClient() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  const {
    query,
    type,
    results,
    loading,
    hasMore,
    history,
    search,
    loadMore,
    loadHistory,
    deleteHistoryEntry,
    clearHistory,
    setType,
  } = useSearch();

  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [toast, setToast] = useState(null);
  const [quoteTarget, setQuoteTarget] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ message: msg, type });

  // Listen for toast events from child components
  useEffect(() => {
    const handleToast = (e) => {
      showToast(e.detail.message, e.detail.type);
    };
    window.addEventListener('showToast', handleToast);
    return () => window.removeEventListener('showToast', handleToast);
  }, []);

  // ── Debounced autocomplete ──
  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await apiClient(`/api/search/autocomplete?q=${encodeURIComponent(inputValue)}`);
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch (err) {
        console.warn('Autocomplete error:', err);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // ── Handle suggestion click ──
  const handleSuggestionSelect = (item) => {
    setShowSuggestions(false);
    if (item._type === 'post') {
      router.push(`/post/${item.id}`);
    } else if (item._type === 'user') {
      if (item.username) {
        router.push(`/profile/${item.username}`);
      } else {
        router.push(`/profile?userId=${item.id}`);
      }
    } else if (item._type === 'group') {
      if (item.topic) {
        router.push(`/groups/topic/${item.topic}`);
      } else {
        router.push(`/groups/${item.id}`);
      }
    }
  };

  // ── Tabs ──
  const tabs = ['all', 'posts', 'people', 'groups'];

  // ── Read query params ──
  useEffect(() => {
    const q = searchParams?.get('q') || '';
    const t = searchParams?.get('type') || 'all';
    if (q) {
      setInputValue(q);
      setActiveTab(t);
      setType(t);
      search(q, t);
    }
    loadHistory();
  }, [searchParams]);

  // ── Handle tab switch ──
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setType(tab);
    if (inputValue.trim().length >= 2) {
      const url = `/search?q=${encodeURIComponent(inputValue.trim())}&type=${tab}`;
      router.push(url);
      search(inputValue.trim(), tab);
    }
    setShowSuggestions(false);
  };

  // ── Handle search submit ──
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    const q = inputValue.trim();
    if (q.length < 2) return;
    const url = `/search?q=${encodeURIComponent(q)}&type=${activeTab}`;
    router.push(url);
    search(q, activeTab);
  };

  // ── Handle history click ──
  const handleHistoryClick = (item) => {
    setInputValue(item.query);
    setActiveTab(item.tab || 'all');
    setType(item.tab || 'all');
    const url = `/search?q=${encodeURIComponent(item.query)}&type=${item.tab || 'all'}`;
    router.push(url);
    search(item.query, item.tab || 'all');
    setShowSuggestions(false);
  };

  // ── Post interaction handlers (same as feed) ──
  const handleLike = async (postId) => {
    if (!user) { showToast('Log in to like.', 'error'); return; }
    // Optimistic update
    const postIndex = results.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    const post = results[postIndex];
    const isLiked = post.isLiked || false;
    const newLikeCount = isLiked ? (post.likeCount || 0) - 1 : (post.likeCount || 0) + 1;
    results[postIndex] = { ...post, isLiked: !isLiked, likeCount: newLikeCount };
    
    try {
      await apiClient(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (_) {
      // Rollback on error
      results[postIndex] = post;
      showToast('Failed to like.', 'error');
    }
  };

  const handleComment = (postId) => {
    if (!user) { showToast('Please log in to comment.', 'error'); return; }
    router.push(`/post/${postId}`);
  };

  const handleRepost = async (postId) => {
    if (!user) { showToast('Log in to repost.', 'error'); return; }
    const postIndex = results.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    const post = results[postIndex];
    const hasReposted = post.hasReposted || false;
    const newRepostCount = hasReposted ? (post.repostCount || 0) - 1 : (post.repostCount || 0) + 1;
    results[postIndex] = { ...post, hasReposted: !hasReposted, repostCount: newRepostCount };
    
    try {
      await apiClient(`/api/posts/${postId}/repost`, { method: 'POST', body: { text: '' } });
      showToast(hasReposted ? 'Repost removed! 🔁' : 'Reposted! 🔁', 'success');
    } catch (_) {
      results[postIndex] = post;
      showToast('Failed to repost.', 'error');
    }
  };

  const handleQuote = (postId) => {
    if (!user) {
      showToast('Please log in to quote.', 'error');
      return;
    }
    const post = results.find((p) => p.id === postId);
    if (post) setQuoteTarget(post);
  };

  const handleQuoteSuccess = () => {
    setQuoteTarget(null);
    showToast('Quote posted! 🎉', 'success');
    // Refresh search results
    const q = searchParams?.get('q') || '';
    const t = searchParams?.get('type') || 'all';
    if (q) search(q, t);
  };

  const handleShare = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this post', url });
    } else {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'));
    }
  };

  // ── Handle follow update ──
  const handleFollowUpdate = (userId, newFollowState) => {
    // Update the user in results if needed
    const userIndex = results.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      results[userIndex] = { ...results[userIndex], isFollowing: newFollowState };
    }
  };

  // ── No query – show history ──
  const showHistory = !inputValue && !searchParams?.get('q');

  // ── Click outside to close dropdown ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" ref={containerRef}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── Search bar with autocomplete ─── */}
      <form onSubmit={handleSubmit} className="mb-6 relative">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              if (inputValue.length >= 2 && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={`Search ${activeTab}...`}
            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-full py-3 pl-11 pr-4 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none transition"
            autoFocus
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setSuggestions([]);
                setShowSuggestions(false);
                const url = `/search`;
                router.push(url);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-txt3)] hover:text-[var(--color-txt)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* ─── Autocomplete dropdown ─── */}
        {showSuggestions && (
          <AutocompleteDropdown
            suggestions={suggestions}
            query={inputValue}
            onSelect={handleSuggestionSelect}
            loading={suggestionsLoading}
            activeTab={activeTab}
          />
        )}
      </form>

      {/* ─── Tabs ─── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
              activeTab === tab
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-card)] text-[var(--color-txt2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      {showHistory ? (
        <div>
          {user && history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[var(--color-txt2)]">Recent searches</h2>
                <button
                  onClick={async () => {
                    if (confirm('Clear all search history?')) {
                      await clearHistory();
                      loadHistory();
                    }
                  }}
                  className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-1">
                {history.map((item) => (
                  <div
                    key={item.id || `${item.query}-${item.tab}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--color-surface)] transition cursor-pointer group"
                    onClick={() => handleHistoryClick(item)}
                  >
                    <svg className="w-4 h-4 text-[var(--color-txt3)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="flex-1 text-sm text-[var(--color-txt)]">{item.query}</span>
                    <span className="text-xs text-[var(--color-txt3)]">{timeAgo(item.searched_at)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryEntry(item.id, item.query, item.tab);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition p-1"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {user && history.length === 0 && (
            <div className="text-center text-sm text-[var(--color-txt3)] py-8">
              No recent searches
            </div>
          )}

          {!user && (
            <div className="text-center text-sm text-[var(--color-txt3)] py-8">
              Log in to save your search history.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {loading && results.length === 0 ? (
            <>
              {activeTab === 'all' && Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
              {activeTab === 'posts' && Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
              {activeTab === 'people' && Array.from({ length: 3 }).map((_, i) => <PeopleSkeleton key={i} />)}
              {activeTab === 'groups' && Array.from({ length: 3 }).map((_, i) => <GroupSkeleton key={i} />)}
            </>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-txt2)]">
              <p>No results found for “<strong className="text-[var(--color-txt)]">{inputValue}</strong>”</p>
            </div>
          ) : (
            <>
              {activeTab === 'all' ? (
                <div className="space-y-3">
                  {results.map((item) => {
                    const type = item._type || (
                      item.text !== undefined ? 'post' :
                      item.topic !== undefined ? 'group' :
                      'user'
                    );
                    if (type === 'post') {
                      return (
                        <PostCard
                          key={item.id}
                          post={item}
                          onLike={handleLike}
                          onComment={handleComment}
                          onRepost={handleRepost}
                          onShare={handleShare}
                          onQuote={handleQuote}
                        />
                      );
                    }
                    if (type === 'group') return <GroupCard key={item.id} group={item} />;
                    return (
                      <PeopleCard 
                        key={item.id} 
                        user={item} 
                        query={inputValue}
                        currentUser={user}
                        onFollowUpdate={handleFollowUpdate}
                      />
                    );
                  })}
                </div>
              ) : activeTab === 'posts' ? (
                results.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handleLike}
                    onComment={handleComment}
                    onRepost={handleRepost}
                    onShare={handleShare}
                    onQuote={handleQuote}
                  />
                ))
              ) : activeTab === 'people' ? (
                results.map((u) => (
                  <PeopleCard 
                    key={u.id} 
                    user={u} 
                    query={inputValue}
                    currentUser={user}
                    onFollowUpdate={handleFollowUpdate}
                  />
                ))
              ) : activeTab === 'groups' ? (
                results.map((group) => <GroupCard key={group.id} group={group} />)
              ) : null}
            </>
          )}

          {hasMore && !loading && (
            <button
              onClick={() => loadMore()}
              className="w-full py-3 text-sm font-medium text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]"
            >
              Load more
            </button>
          )}
        </div>
      )}

      {quoteTarget && (
        <QuoteModal
          post={quoteTarget}
          onClose={() => setQuoteTarget(null)}
          onSuccess={handleQuoteSuccess}
        />
      )}
    </div>
  );
}