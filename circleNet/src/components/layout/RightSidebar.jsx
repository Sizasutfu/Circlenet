// src/components/layout/RightSidebar.jsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useExplore } from '@/contexts/ExploreContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserAvatar from '@/components/ui/UserAvatar';
import ReasonBadge from '@/components/ui/ReasonBadge';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

export default function RightSidebar() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const {
    topics,
    topicsLoading,
    people,
    peopleLoading,
    loadTopics,
    loadPeople,
    newMembers,
    newMembersLoading,
    loadNewMembers,
  } = useExplore();

  const isPostDetail = /^\/post\/\d+$/.test(pathname);
  const isArticles = pathname.startsWith('/articles');

  // ── Author info ──
  const postId = isPostDetail ? pathname.split('/')[2] : null;
  const [author, setAuthor] = useState(null);
  const [authorLoading, setAuthorLoading] = useState(false);

  // ── Top articles ──
  const [topArticles, setTopArticles] = useState([]);
  const [topArticlesLoading, setTopArticlesLoading] = useState(false);

  // ── Fetch author ──
  useEffect(() => {
    if (!isPostDetail || !postId) return;
    setAuthorLoading(true);
    const fetchAuthor = async () => {
      try {
        const res = await apiClient(`/api/posts/${postId}`);
        const post = res.data || res;
        let userId = post.user?.id || post.authorId || post.userId;
        let userName = post.user?.name || post.author || 'Anonymous';
        let userPicture = post.user?.picture || post.authorPicture || null;
        let userUsername = post.user?.username || post.authorUsername || post.username || '';

        if (!userId) {
          setAuthor({ name: userName, username: userUsername, picture: userPicture });
          setAuthorLoading(false);
          return;
        }

        const profileRes = await apiClient(`/api/users/${userId}/profile`);
        const profile = profileRes.data || profileRes;
        setAuthor({
          id: userId,
          name: profile.name || userName,
          username: profile.username || userUsername,
          picture: profile.picture || userPicture,
          bio: profile.bio || '',
          postCount: profile.postCount || 0,
          followerCount: profile.followerCount || 0,
          followingCount: profile.followingCount || 0,
          isFollowing: profile.isFollowing || false,
        });
      } catch (err) {
        console.error('Failed to fetch author:', err);
        setAuthor(null);
      } finally {
        setAuthorLoading(false);
      }
    };
    fetchAuthor();
  }, [isPostDetail, postId]);

  // ── Fetch top articles ──
  useEffect(() => {
    if (!isArticles) return;
    setTopArticlesLoading(true);
    const fetchTopArticles = async () => {
      try {
        const res = await apiClient('/api/articles/top?limit=5');
        const data = res.data || res;
        const articles = data.articles || data || [];
        setTopArticles(articles);
      } catch (err) {
        console.warn('Failed to fetch top articles:', err);
        setTopArticles([]);
      } finally {
        setTopArticlesLoading(false);
      }
    };
    fetchTopArticles();
  }, [isArticles]);

  // ── Load data ──
  useEffect(() => {
    loadTopics();
    if (user) {
      loadPeople();
      loadNewMembers();
    }
  }, [user]);

  const handleFollow = async (userId) => {
    try {
      await apiClient(`/api/follow/${userId}`, { method: 'POST' });
      loadPeople();
      if (author && author.id === userId) {
        setAuthor(prev => ({ ...prev, isFollowing: true, followerCount: (prev.followerCount || 0) + 1 }));
      }
    } catch (_) {}
  };

  const handleUnfollow = async (userId) => {
    try {
      await apiClient(`/api/unfollow/${userId}`, { method: 'DELETE' });
      loadPeople();
      if (author && author.id === userId) {
        setAuthor(prev => ({ ...prev, isFollowing: false, followerCount: Math.max(0, (prev.followerCount || 0) - 1) }));
      }
    } catch (_) {}
  };

  const handleDismiss = async (userId) => {
    try {
      await apiClient('/api/recommendations/dismiss', {
        method: 'POST',
        body: { dismissedUserId: userId },
      });
      loadPeople();
    } catch (_) {}
  };

  function renderAvatar(picture, name, size = 'w-12 h-12') {
    const avatarUrl = resolveMediaUrl(picture);
    if (avatarUrl) {
      return <img src={avatarUrl} alt={name || 'User'} className={`${size} rounded-full object-cover flex-shrink-0`} />;
    }
    return <AvatarPlaceholder size={size} />;
  }

  return (
    <aside className="hidden lg:block flex-shrink-0 space-y-6 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide pb-6">
      {/* ── Search ── */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search Circlenet"
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full py-2.5 pl-10 pr-4 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition"
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const query = e.target.value.trim();
              if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
            }
          }}
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* ── Trending Topics ── */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="font-head font-bold text-[var(--color-txt)] text-sm mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 2C10 6 6 8 6 12c0 3.314 2.686 6 6 6s6-2.686 6-6c0-4-4-6-6-10z" />
            <path d="M12 22c-3.314 0-6-2.686-6-6 0-2 1.5-4 3-6 1.5 2 3 4 3 6 0 3.314-2.686 6-6 6z" />
          </svg>
          Trending Topics
        </h3>
        {topicsLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 bg-[var(--color-surface)] rounded animate-pulse mb-2" />)
        ) : topics.length === 0 ? (
          <p className="text-xs text-[var(--color-txt3)]">No trending topics</p>
        ) : (
          <ul className="space-y-2">
            {topics.slice(0, 5).map((topic) => (
              <li key={topic.topic}>
                <Link href={`/topic/${encodeURIComponent(topic.topic)}`} className="block text-sm text-[var(--color-txt)] hover:text-[var(--color-accent)] transition truncate">
                  #{topic.topic}
                  <span className="text-xs text-[var(--color-txt3)] ml-1">{topic.post_count} posts</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/explore" className="block text-xs text-[var(--color-accent)] hover:underline mt-2">See more →</Link>
      </div>

      {/* ── Top Articles ── */}
      {isArticles && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="font-head font-bold text-[var(--color-txt)] text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8M8 12h6M8 16h4" />
            </svg>
            Top Articles
          </h3>
          {topArticlesLoading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 bg-[var(--color-surface)] rounded animate-pulse mb-2" />)
          ) : topArticles.length === 0 ? (
            <p className="text-xs text-[var(--color-txt3)]">No top articles</p>
          ) : (
            <ul className="space-y-2">
              {topArticles.slice(0, 5).map((article) => (
                <li key={article.id}>
                  <Link href={`/articles/${article.slug || article.id}`} className="block text-sm text-[var(--color-txt)] hover:text-[var(--color-accent)] transition truncate">
                    {article.title}
                    {article.tags && article.tags.length > 0 && (
                      <span className="text-xs text-[var(--color-txt3)] ml-1">#{article.tags[0]}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/articles" className="block text-xs text-[var(--color-accent)] hover:underline mt-2">Browse all →</Link>
        </div>
      )}

      {/* ── Author Profile ── */}
      {isPostDetail && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="font-head font-bold text-[var(--color-txt)] text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Author
          </h3>
          {authorLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/2 bg-[var(--color-surface)] animate-pulse rounded" />
                <div className="h-3 w-3/4 bg-[var(--color-surface)] animate-pulse rounded" />
              </div>
            </div>
          ) : author ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${author.username}`} className="flex-shrink-0">
                  {renderAvatar(author.picture, author.name, 'w-12 h-12')}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${author.username}`} className="font-head font-bold text-[var(--color-txt)] hover:text-[var(--color-accent)] transition text-sm">
                    {author.name}
                  </Link>
                  <p className="text-xs text-[var(--color-txt2)] truncate">@{author.username}</p>
                  {author.bio && <p className="text-xs text-[var(--color-txt3)] mt-1 line-clamp-2">{author.bio}</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--color-txt3)]">
                <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(author.postCount || 0)}</span> posts</span>
                <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(author.followerCount || 0)}</span> followers</span>
                <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(author.followingCount || 0)}</span> following</span>
              </div>
              {user && user.id !== author.id && (
                <button
                  onClick={() => author.isFollowing ? handleUnfollow(author.id) : handleFollow(author.id)}
                  className={`w-full py-1.5 rounded-full text-sm font-medium transition ${author.isFollowing ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]' : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'}`}
                >
                  {author.isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-txt3)]">Could not load author.</p>
          )}
        </div>
      )}

      {/* ── People to Follow ── */}
      {!isPostDetail && !isArticles && user && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="font-head font-bold text-[var(--color-txt)] text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            Who to Follow
          </h3>
          {peopleLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] animate-pulse" />
                <div className="flex-1 h-3 bg-[var(--color-surface)] animate-pulse rounded" />
              </div>
            ))
          ) : people.length === 0 ? (
            <p className="text-xs text-[var(--color-txt3)]">No suggestions</p>
          ) : (
            <ul className="space-y-3">
              {people.slice(0, 4).map((p) => {
                const profileHref = p.username ? `/profile/${p.username}` : `/profile?userId=${p.id}`;
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <Link href={profileHref} className="flex-shrink-0">
                      {renderAvatar(p.picture, p.name, 'w-8 h-8')}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link href={profileHref} className="text-sm font-semibold text-[var(--color-txt)] hover:text-[var(--color-accent)] transition truncate">
                        {p.name}
                      </Link>
                      <p className="text-xs text-[var(--color-txt3)] truncate">@{p.username || 'user'}</p>
                      <ReasonBadge reasons={p.reasons} className="mt-0.5" />
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <button
                        onClick={() => handleDismiss(p.id)}
                        className="text-[10px] text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition"
                      >
                        Not interested
                      </button>
                      <button
                        onClick={() => handleFollow(p.id)}
                        className="px-3 py-1 text-xs font-medium bg-[var(--color-accent)] text-white rounded-full hover:bg-[var(--color-accent-h)] transition"
                      >
                        Follow
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/explore" className="block text-xs text-[var(--color-accent)] hover:underline mt-2">Explore more →</Link>
        </div>
      )}

      {/* ── New Members ── */}
      {user && newMembers.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
          <h3 className="font-head font-bold text-[var(--color-txt)] text-sm mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              <path d="M19 19l-1.5-2.5L15 15l2.5-1.5L19 11l1.5 2.5L23 15l-2.5 1.5L19 19z" />
              <path d="M5 19l-1.5-2.5L1 15l2.5-1.5L5 11l1.5 2.5L9 15l-2.5 1.5L5 19z" />
            </svg>
            New Members
          </h3>
          <ul className="space-y-2">
            {newMembers.slice(0, 4).map((u) => {
              const profileHref = u.username ? `/profile/${u.username}` : `/profile?userId=${u.id}`;
              return (
                <li key={u.id}>
                  <Link href={profileHref} className="flex items-center gap-2 text-sm text-[var(--color-txt)] hover:text-[var(--color-accent)] transition">
                    {renderAvatar(u.picture, u.name, 'w-6 h-6')}
                    <span className="truncate">{u.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}