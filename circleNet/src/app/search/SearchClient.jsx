// src/app/search/SearchClient.jsx
'use client';

import { useEffect, useState } from 'react';
import { useSearch } from '@/contexts/SearchContext';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import GroupCard from '@/components/groups/GroupCard';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import VerificationBadge from '@/components/ui/VerificationBadge';
import { resolveMediaUrl } from '@/lib/url';

function highlight(text, q) {
  if (!text) return '';
  const safe = text.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m] || m);
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${safeQ})`, 'gi'), '<mark class="hl">$1</mark>');
}

export default function SearchClient() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
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
  } = useSearch();

  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('posts');

  // ── Read query params ──
  useEffect(() => {
    const q = searchParams?.get('q') || '';
    const t = searchParams?.get('type') || 'posts';
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
  };

  // ── Handle search submit ──
  const handleSubmit = (e) => {
    e.preventDefault();
    const q = inputValue.trim();
    if (q.length < 2) return;
    const url = `/search?q=${encodeURIComponent(q)}&type=${activeTab}`;
    router.push(url);
    search(q, activeTab);
  };

  // ── People card with verification badge ──
  const PeopleCard = ({ user: u, query }) => {
    const avatarUrl = resolveMediaUrl(u.picture);
    const isVerified = u.verified === 1 || u.verified === true;

    return (
      <div
        className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition cursor-pointer"
        onClick={() => router.push(`/profile?userId=${u.id}`)}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={u.name}
            className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="w-10 h-10" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--color-txt)] flex items-center gap-1">
            <span dangerouslySetInnerHTML={{ __html: highlight(u.name, query) }} />
            {isVerified && <VerificationBadge size="w-3.5 h-3.5" />}
          </div>
          <div className="text-sm text-[var(--color-txt2)]" dangerouslySetInnerHTML={{ __html: highlight(u.email || u.username || '', query) }} />
          <div className="text-xs text-[var(--color-txt3)]">{u.postCount || 0} posts · {u.followerCount || 0} followers</div>
        </div>
        {user && user.id !== u.id && (
          <button className="px-4 py-1.5 text-sm rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] transition">
            {u.isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>
    );
  };

  // ── No query ──
  if (!inputValue && !searchParams?.get('q')) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center py-16 text-[var(--color-txt2)]">
          <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm">Type to search posts, people, or groups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-full py-3 pl-11 pr-4 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none transition"
            autoFocus
          />
        </div>
      </form>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['posts', 'people', 'groups'].map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabSwitch(tab)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === tab ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-card)] text-[var(--color-txt2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)]'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {loading && results.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-[var(--color-surface)] rounded" />
                  <div className="h-3 w-1/2 bg-[var(--color-surface)] rounded" />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full bg-[var(--color-surface)] rounded" />
                <div className="h-3 w-3/4 bg-[var(--color-surface)] rounded" />
              </div>
            </div>
          ))
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-txt2)]">
            <p>No {activeTab} found for “<strong className="text-[var(--color-txt)]">{inputValue}</strong>”</p>
          </div>
        ) : (
          <>
            {activeTab === 'posts' && results.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {activeTab === 'people' && results.map((u) => (
              <PeopleCard key={u.id} user={u} query={inputValue} />
            ))}
            {activeTab === 'groups' && results.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
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
    </div>
  );
}