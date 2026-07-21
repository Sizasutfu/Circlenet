// src/app/explore/ExploreClient.jsx
'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { useExplore } from '@/contexts/ExploreContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import UserAvatar from '@/components/ui/UserAvatar';
import ReasonBadge from '@/components/ui/ReasonBadge';
import Link from 'next/link';

// ── SVG Icons ──
const FireIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 2C10 6 6 8 6 12c0 3.314 2.686 6 6 6s6-2.686 6-6c0-4-4-6-6-10z" />
    <path d="M12 22c-3.314 0-6-2.686-6-6 0-2 1.5-4 3-6 1.5 2 3 4 3 6 0 3.314-2.686 6-6 6z" />
  </svg>
);

const TrendingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const PeopleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M19 19l-1.5-2.5L15 15l2.5-1.5L19 11l1.5 2.5L23 15l-2.5 1.5L19 19z" />
    <path d="M5 19l-1.5-2.5L1 15l2.5-1.5L5 11l1.5 2.5L9 15l-2.5 1.5L5 19z" />
  </svg>
);

// ── Topic Row ──
function TopicRow({ topic, index }) {
  const count = topic.post_count >= 1000 ? (topic.post_count / 1000).toFixed(1) + 'k' : topic.post_count;
  
  return (
    <Link href={`/topic/${encodeURIComponent(topic.topic)}`} 
      className="flex items-center gap-4 py-2.5 px-3 hover:bg-[var(--color-surface)] rounded-lg transition cursor-pointer border-b border-[var(--color-border)] last:border-0"
    >
      <span className="text-sm font-bold text-[var(--color-txt3)] w-6 text-right">{index + 1}</span>
      <span className="flex-1 font-medium text-[var(--color-txt)]">#{topic.topic}</span>
      <span className="text-sm text-[var(--color-txt2)]">{count} posts</span>
    </Link>
  );
}

// ── People Card ──
function PeopleCard({ user, onFollow, isFollowing, onDismiss }) {
  const { user: currentUser } = useAuth();

  const handleClick = () => {
    if (user.username) {
      window.location.href = `/profile/${user.username}`;
    } else if (user.id) {
      window.location.href = `/profile?userId=${user.id}`;
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss(user.id);
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    onFollow(user.id);
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition cursor-pointer" onClick={handleClick}>
      <UserAvatar user={user} size="w-12 h-12" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[var(--color-txt)]">{user.name}</div>
        <div className="text-sm text-[var(--color-txt2)]">@{user.username || 'user'}</div>
        <div className="text-xs text-[var(--color-txt3)] flex items-center gap-2 flex-wrap">
          <span>{user.post_count ?? user.postCount ?? 0} posts · {user.follower_count ?? user.followerCount ?? 0} followers</span>
          <ReasonBadge reasons={user.reasons} />
        </div>
      </div>
      {currentUser && currentUser.id !== user.id && (
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-[10px] text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition"
          >
            Not interested
          </button>
          <button
            onClick={handleFollowClick}
            className="px-4 py-1.5 text-sm rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
            disabled={isFollowing}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Member Card ──
function NewMemberCard({ user }) {
  const handleClick = () => {
    if (user.username) {
      window.location.href = `/profile/${user.username}`;
    } else if (user.id) {
      window.location.href = `/profile?userId=${user.id}`;
    }
  };

  const diff = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
  const joinedText = diff === 0 ? 'Joined today' : diff === 1 ? 'Joined yesterday' : `Joined ${diff} days ago`;

  return (
    <div
      className="relative p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:shadow-[var(--color-shadow)] transition cursor-pointer"
      onClick={handleClick}
    >
      <span className="absolute -top-2 -right-2 bg-[var(--color-green)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
      <div className="flex items-center gap-3">
        <UserAvatar user={user} size="w-12 h-12" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--color-txt)]">{user.name}</div>
          <div className="text-xs text-[var(--color-green)]">{joinedText}</div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──
function PeopleSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
      <div className="w-12 h-12 rounded-full bg-[var(--color-surface)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
        <div className="h-3 w-1/2 bg-[var(--color-surface)] rounded" />
      </div>
      <div className="w-16 h-8 bg-[var(--color-surface)] rounded-full" />
    </div>
  );
}

// ── Main ──
export default function ExploreClient() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    topics,
    topicsLoading,
    people,
    peopleLoading,
    trending,
    trendingLoading,
    newMembers,
    newMembersLoading,
    loadTopics,
    loadPeople,
    loadTrending,
    loadNewMembers,
    getFilteredTrending,
    setTrendingCategory,
    setTrendingSort,
    trendingCategory,
    trendingSort,
  } = useExplore();

  const [following, setFollowing] = useState(new Set());

  useEffect(() => {
    loadTopics();
    loadTrending();
    if (user) {
      loadPeople();
      loadNewMembers();
    }
  }, [user]);

  const filteredTrending = getFilteredTrending();

  const handleFollow = async (userId) => {
    if (following.has(userId)) {
      setFollowing(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      try {
        await apiClient(`/api/unfollow/${userId}`, { method: 'DELETE' });
        loadPeople();
      } catch (_) {
        setFollowing(prev => new Set(prev).add(userId));
      }
    } else {
      setFollowing(prev => new Set(prev).add(userId));
      try {
        await apiClient(`/api/follow/${userId}`, { method: 'POST' });
        loadPeople();
      } catch (_) {
        setFollowing(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
    }
  };

  const handleDismiss = (userId) => {
    // The API call is made inside PeopleCard, we just refresh the list
    loadPeople();
  };

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'popular', label: 'Popular' },
    { id: 'discussed', label: 'Discussed' },
    { id: 'shared', label: 'Shared' },
    { id: 'media', label: 'Media' },
  ];

  const sorts = [
    { id: 'hot', label: 'Hot' },
    { id: 'newest', label: 'Newest' },
    { id: 'top', label: 'Top' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-6">Explore</h1>

      {/* Trending Topics */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-head font-bold text-[var(--color-txt)] flex items-center gap-2">
            <FireIcon /> Trending Topics
          </h2>
          <button onClick={() => loadTopics()} className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
            Refresh
          </button>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {topicsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--color-border)] last:border-0">
                <div className="w-6 h-4 bg-[var(--color-surface)] animate-pulse rounded" />
                <div className="flex-1 h-4 bg-[var(--color-surface)] animate-pulse rounded w-3/4" />
                <div className="h-3 w-16 bg-[var(--color-surface)] animate-pulse rounded" />
              </div>
            ))
          ) : topics.length === 0 ? (
            <div className="p-6 text-center text-[var(--color-txt2)]">No topics yet — start posting with #hashtags!</div>
          ) : (
            topics.map((topic, i) => <TopicRow key={topic.topic} topic={topic} index={i} />)
          )}
        </div>
      </section>

      {/* Trending Posts */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-head font-bold text-[var(--color-txt)] flex items-center gap-2">
            <TrendingIcon /> Trending Posts
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTrendingCategory(cat.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition ${trendingCategory === cat.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {sorts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTrendingSort(s.id)}
                  className={`px-2 py-1 text-xs font-medium rounded-full transition ${trendingSort === s.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {trendingLoading ? (
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
          ) : filteredTrending.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-txt2)]">No posts match this filter</div>
          ) : (
            filteredTrending.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>
      </section>

      {/* People You May Know */}
      {user && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-head font-bold text-[var(--color-txt)] flex items-center gap-2">
              <PeopleIcon /> People You May Know
            </h2>
            <button onClick={() => loadPeople()} className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {peopleLoading ? (
              Array.from({ length: 3 }).map((_, i) => <PeopleSkeleton key={i} />)
            ) : people.length === 0 ? (
              <div className="text-center py-6 text-[var(--color-txt2)]">No suggestions right now. Interact with posts to get recommendations!</div>
            ) : (
              people.map((p) => (
                <PeopleCard
                  key={p.id}
                  user={p}
                  onFollow={handleFollow}
                  isFollowing={following.has(p.id)}
                  onDismiss={handleDismiss}
                />
              ))
            )}
          </div>
        </section>
      )}

      {/* New Members */}
      {user && newMembers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-head font-bold text-[var(--color-txt)] flex items-center gap-2">
              <SparklesIcon /> New Members
            </h2>
            <button onClick={() => loadNewMembers()} className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {newMembersLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-surface)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/2 bg-[var(--color-surface)] rounded" />
                      <div className="h-3 w-1/3 bg-[var(--color-surface)] rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              newMembers.map((u) => <NewMemberCard key={u.id} user={u} />)
            )}
          </div>
        </section>
      )}
    </div>
  );
}