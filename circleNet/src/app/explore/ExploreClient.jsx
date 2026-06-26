// src/app/explore/ExploreClient.jsx
'use client';

import { useEffect, useState } from 'react';
import { useExplore } from '@/contexts/ExploreContext';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import Link from 'next/link';

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    if (m === "'") return '&#39;';
    return m;
  });
}

function joinedAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Joined today';
  if (diff === 1) return 'Joined yesterday';
  return `Joined ${diff} days ago`;
}

function PeopleCard({ user, onFollow }) {
  const { user: currentUser } = useAuth();
  const color = stringToColor(user.name || '');
  const initial = (user.name || '?').charAt(0).toUpperCase();
  const avatarUrl = user.picture;

  return (
    <div className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition cursor-pointer" onClick={() => window.location.href = `/profile?userId=${user.id}`}>
      <div
        className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden"
        style={{ background: avatarUrl ? 'transparent' : color }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={initial} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[var(--color-txt)]">{user.name}</div>
        <div className="text-sm text-[var(--color-txt2)]">@{user.username || 'user'}</div>
        <div className="text-xs text-[var(--color-txt3)]">{user.postCount || 0} posts · {user.followerCount || 0} followers</div>
      </div>
      {currentUser && currentUser.id !== user.id && (
        <button
          onClick={(e) => { e.stopPropagation(); onFollow(user.id); }}
          className="px-4 py-1.5 text-sm rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] transition"
        >
          Follow
        </button>
      )}
    </div>
  );
}

function TopicRow({ topic, index }) {
  const count = topic.post_count >= 1000 ? (topic.post_count / 1000).toFixed(1) + 'k' : topic.post_count;

  return (
    <Link href={`/topic/${encodeURIComponent(topic.topic)}`} className="flex items-center gap-4 py-2.5 px-3 hover:bg-[var(--color-surface)] rounded-lg transition cursor-pointer border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm font-bold text-[var(--color-txt3)] w-6 text-right">{index + 1}</span>
      <span className="flex-1 font-medium text-[var(--color-txt)]">#{topic.topic}</span>
      <span className="text-sm text-[var(--color-txt2)]">{count} posts</span>
    </Link>
  );
}

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
    // Follow logic here – implement via API
    setFollowing((prev) => new Set(prev).add(userId));
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

      {/* Topics */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-head font-bold text-[var(--color-txt)]">🔥 Trending Topics</h2>
          <button
            onClick={() => loadTopics()}
            className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
          >
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
          <h2 className="text-lg font-head font-bold text-[var(--color-txt)]">📈 Trending Posts</h2>
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

      {/* People */}
      {user && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-head font-bold text-[var(--color-txt)]">👥 People You May Know</h2>
            <button
              onClick={() => loadPeople()}
              className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {peopleLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-surface)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-[var(--color-surface)] rounded" />
                    <div className="h-3 w-1/2 bg-[var(--color-surface)] rounded" />
                  </div>
                  <div className="w-16 h-8 bg-[var(--color-surface)] rounded-full" />
                </div>
              ))
            ) : people.length === 0 ? (
              <div className="text-center py-6 text-[var(--color-txt2)]">No suggestions right now. Interact with posts to get recommendations!</div>
            ) : (
              people.map((p) => <PeopleCard key={p.id} user={p} onFollow={handleFollow} />)
            )}
          </div>
        </section>
      )}

      {/* New Members */}
      {user && newMembers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-head font-bold text-[var(--color-txt)]">✨ New Members</h2>
            <button
              onClick={() => loadNewMembers()}
              className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
            >
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {newMembers.map((u) => {
              const color = stringToColor(u.name || '');
              const initial = (u.name || '?').charAt(0).toUpperCase();
              const avatarUrl = u.picture;

              return (
                <div
                  key={u.id}
                  className="relative p-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:shadow-[var(--color-shadow)] transition cursor-pointer"
                  onClick={() => router.push(`/profile?userId=${u.id}`)}
                >
                  <span className="absolute -top-2 -right-2 bg-[var(--color-green)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden"
                      style={{ background: avatarUrl ? 'transparent' : color }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={initial} className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[var(--color-txt)]">{u.name}</div>
                      <div className="text-xs text-[var(--color-green)]">{joinedAgo(u.createdAt)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}