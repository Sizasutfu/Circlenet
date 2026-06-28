// src/app/topic/[slug]/TopicClient.jsx
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useExplore } from '@/contexts/ExploreContext';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';

export default function TopicClient({ slug }) {
  const { user } = useAuth();
  const router = useRouter();
  const {
    currentTopic,
    topicPosts,
    topicHasMore,
    topicLoading,
    loadTopicFeed,
    followTopic,
  } = useExplore();

  const loadMoreRef = useRef(null);

  // ── Decode the slug once ──
  const decodedSlug = useMemo(() => {
    try {
      return decodeURIComponent(slug);
    } catch (_) {
      return slug;
    }
  }, [slug]);

  // ── Deduplicate posts ──
  const uniquePosts = useMemo(() => {
    const seen = new Set();
    return topicPosts.filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  }, [topicPosts]);

  useEffect(() => {
    if (!decodedSlug) return;
    loadTopicFeed(decodedSlug, 1, false);
    if (user) followTopic(decodedSlug);
  }, [decodedSlug, user]);

  // ── Infinite scroll ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && topicHasMore && !topicLoading) {
          loadTopicFeed(decodedSlug, currentTopic ? undefined : 1, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [topicHasMore, topicLoading, decodedSlug, currentTopic]);

  if (!decodedSlug) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading topic…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">#{decodedSlug}</h1>
        <p className="text-sm text-[var(--color-txt2)]">Posts tagged with #{decodedSlug}</p>
      </div>

      <div className="space-y-4">
        {topicLoading && uniquePosts.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
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
        ) : uniquePosts.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-txt2)]">No posts for #{decodedSlug} yet.</div>
        ) : (
          uniquePosts.map((post) => <PostCard key={post.id} post={post} />)
        )}

        {topicHasMore && (
          <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
            {topicLoading ? 'Loading more…' : 'Load more'}
          </div>
        )}
      </div>
    </div>
  );
}