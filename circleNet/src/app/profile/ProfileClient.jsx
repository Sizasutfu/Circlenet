// src/app/profile/ProfileClient.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PostCard from '@/components/ui/PostCard'; // 👈 new component

// ── Toggle mock data ──
const USE_MOCK_DATA = false;

// ── Helpers ──
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function getMockProfile(userId, currentUserName) {
  return {
    id: userId,
    name: currentUserName || 'John Doe',
    username: currentUserName ? currentUserName.toLowerCase().replace(/\s/g, '') : 'johndoe',
    bio: 'Mock bio – replace with real data.',
    location: 'Mock City',
    website: null,
    joined: new Date().toISOString(),
    picture: null,
    coverImage: null,
    postCount: 0,
    followerCount: 0,
    followingCount: 0,
    isFollowing: false,
  };
}

async function apiCallWithTimeout(endpoint, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await apiClient(endpoint, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default function ProfileClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const userIdParam = searchParams.get('userId');
  const targetId = userIdParam ? parseInt(userIdParam, 10) : user?.id;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsLoadMoreRef = useRef(null);

  // Guard to prevent double-fetch in strict mode
  const initialFetchDone = useRef(false);

  const isOwnProfile = targetId === user?.id;

  // ── Single effect to fetch initial data ──
  useEffect(() => {
    if (!user) {
      setError('Please log in.');
      setLoading(false);
      return;
    }
    if (!targetId) {
      setError('Invalid user.');
      setLoading(false);
      return;
    }

    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    const fetchProfile = async () => {
      try {
        if (USE_MOCK_DATA) {
          setProfile(getMockProfile(targetId, user?.name));
        } else {
          const response = await apiCallWithTimeout(`/api/users/${targetId}/profile`, {}, 5000);
          setProfile(response.data);
        }
      } catch (err) {
        console.warn('Profile API error, using mock:', err);
        setProfile(getMockProfile(targetId, user?.name));
      } finally {
        setLoading(false);
      }
    };

    const fetchPosts = async () => {
      try {
        if (USE_MOCK_DATA) {
          setPosts([
            { id: 1, text: 'Mock post 1', createdAt: new Date().toISOString(), likes: [], comments: [], user: { name: user?.name, username: user?.username, picture: null } },
          ]);
          setPostsHasMore(false);
        } else {
          const response = await apiCallWithTimeout(
            `/api/posts?userId=${targetId}&page=1&limit=20`,
            {},
            5000
          );
          const postsData = response.data?.posts || [];
          // Ensure each post has a 'user' object (if API doesn't include it, we can mock)
          const postsWithUser = postsData.map((p) => ({
            ...p,
            user: p.user || { name: 'Unknown', username: 'unknown', picture: null },
          }));
          const hasMore = response.data?.hasMore || postsData.length === 20;
          setPosts(postsWithUser);
          setPostsHasMore(hasMore);
          setPostsPage(1);
        }
      } catch (err) {
        console.warn('Posts API error, using mock:', err);
        setPosts([
          { id: 1, text: 'Mock post – API unavailable', createdAt: new Date().toISOString(), likes: [], comments: [], user: { name: user?.name, username: user?.username, picture: null } },
        ]);
        setPostsHasMore(false);
      } finally {
        setPostsLoading(false);
      }
    };

    fetchProfile();
    fetchPosts();
  }, [targetId, user]);

  // ── Load more posts ──
  const loadMorePosts = async () => {
    if (!postsHasMore || postsLoading) return;
    setPostsLoading(true);
    try {
      const nextPage = postsPage + 1;
      const response = await apiCallWithTimeout(
        `/api/posts?userId=${targetId}&page=${nextPage}&limit=20`,
        {},
        5000
      );
      const newPosts = response.data?.posts || [];
      const hasMore = response.data?.hasMore || newPosts.length === 20;
      const postsWithUser = newPosts.map((p) => ({
        ...p,
        user: p.user || { name: 'Unknown', username: 'unknown', picture: null },
      }));
      setPosts((prev) => [...prev, ...postsWithUser]);
      setPostsHasMore(hasMore);
      setPostsPage(nextPage);
    } catch (err) {
      console.warn('Load more posts error:', err);
    } finally {
      setPostsLoading(false);
    }
  };

  // ── Intersection Observer for infinite scroll ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && postsHasMore && !postsLoading) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );
    if (postsLoadMoreRef.current) {
      observer.observe(postsLoadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [postsHasMore, postsLoading]);

  // ── Follow toggle ──
  const handleFollowToggle = async () => {
    if (!user || !profile) return;
    const following = profile.isFollowing;
    const method = following ? 'DELETE' : 'POST';
    const endpoint = following ? `/api/unfollow/${targetId}` : `/api/follow/${targetId}`;
    try {
      if (!USE_MOCK_DATA) {
        await apiCallWithTimeout(endpoint, { method }, 5000);
      }
      setProfile((prev) => ({
        ...prev,
        isFollowing: !prev?.isFollowing,
        followerCount: prev?.isFollowing ? (prev.followerCount || 0) - 1 : (prev.followerCount || 0) + 1,
      }));
    } catch (err) {
      console.error('Follow action failed:', err);
    }
  };

  // ── Avatar upload ──
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (USE_MOCK_DATA) {
      const reader = new FileReader();
      reader.onload = (ev) => setProfile((prev) => ({ ...prev, picture: ev.target.result }));
      reader.readAsDataURL(file);
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    try {
      const token = localStorage.getItem('circle_token');
      const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${baseURL}/api/users/${user.id}/picture`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const response = await apiCallWithTimeout(`/api/users/${targetId}/profile`, {}, 5000);
      setProfile(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Cover upload ──
  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    if (USE_MOCK_DATA) {
      const reader = new FileReader();
      reader.onload = (ev) => setProfile((prev) => ({ ...prev, coverImage: ev.target.result }));
      reader.readAsDataURL(file);
      return;
    }
    const formData = new FormData();
    formData.append('image', file);
    try {
      const token = localStorage.getItem('circle_token');
      const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const res = await fetch(`${baseURL}/api/users/${user.id}/cover`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const response = await apiCallWithTimeout(`/api/users/${targetId}/profile`, {}, 5000);
      setProfile(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Render states ──
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p>Please log in.</p>
        <Link href="/login" className="text-[var(--color-accent)] hover:underline">Go to Login</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading profile…</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  // ── Render profile data ──
  const {
    name,
    username,
    bio,
    picture,
    coverImage,
    location,
    website,
    school,
    occupation,
    gender,
    phone,
    dateOfBirth,
    joined,
    postCount,
    followerCount,
    followingCount,
    isFollowing,
    mutualFollowers,
  } = profile || {};

  const avatarUrl = resolveMediaUrl(picture);
  const coverUrl = resolveMediaUrl(coverImage);
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const avatarColor = stringToColor(name || '');
  const joinDate = joined ? new Date(joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;

  const aboutDetails = [
    { label: 'Location', value: location },
    { label: 'School', value: school },
    { label: 'Occupation', value: occupation },
    { label: 'Website', value: website && (
      <a href={website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
        {website.replace(/^https?:\/\//, '')}
      </a>
    )},
    { label: 'Gender', value: gender && gender.charAt(0).toUpperCase() + gender.slice(1) },
    { label: 'Phone', value: phone },
    { label: 'Date of Birth', value: dateOfBirth },
    { label: 'Joined', value: joinDate },
  ].filter(d => d.value);

  // ── UI ──
  return (
    <div className="max-w-4xl mx-auto">
      {/* Cover */}
      <div className="relative h-48 md:h-64 rounded-[var(--radius-radius)] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
        {coverUrl ? (
          <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${avatarColor}cc 0%, ${avatarColor}55 60%, transparent 100%)` }}
          />
        )}
        {isOwnProfile && (
          <label htmlFor="cover-upload" className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/70 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            Change Cover
            <input type="file" id="cover-upload" className="hidden" accept="image/*" onChange={handleCoverUpload} />
          </label>
        )}
        <div className="absolute -bottom-12 left-6 md:left-8">
          <div className="relative h-24 w-24 md:h-28 md:w-28">
            <div
              className="w-full h-full rounded-full border-4 border-[var(--color-card)] bg-[var(--color-surface)] flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-[var(--color-shadow)] overflow-hidden"
              style={{ background: avatarUrl ? 'transparent' : avatarColor }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : initial}
            </div>
            {isOwnProfile && (
              <>
                <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-[var(--color-accent)] rounded-full p-1.5 cursor-pointer hover:bg-[var(--color-accent-h)] transition shadow-md">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
                {avatarUrl && (
                  <button onClick={() => window.open(avatarUrl, '_blank')} className="absolute top-0 right-0 bg-black/40 rounded-full p-1.5 hover:bg-black/60 transition">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-16 px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-head font-bold text-[var(--color-txt)]">{name}</h1>
            <p className="text-[var(--color-txt2)]">@{username}</p>
            {bio && <p className="mt-2 text-[var(--color-txt2)] max-w-lg">{bio}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-txt3)]">
              {location && <span>📍 {location}</span>}
              {website && <a href={website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">🔗 {website}</a>}
              {joinDate && <span>📅 {joinDate}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              <>
                <Link href="/settings" className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-accent)] transition text-sm font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </Link>
                <button onClick={() => {/* logout */}} className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-rose-bg)] hover:text-[var(--color-rose)] transition text-sm font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Logout
                </button>
              </>
            ) : (
              <>
                <button onClick={handleFollowToggle} className={`px-4 py-2 rounded-[var(--radius-radius-sm)] text-sm font-medium transition ${isFollowing ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]' : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] shadow-md shadow-[var(--color-accent-glow)]'}`}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] transition text-sm font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  Message
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-6 text-sm">
          <div><span className="font-bold text-[var(--color-txt)]">{postCount || 0}</span> <span className="text-[var(--color-txt2)]">Posts</span></div>
          <div><span className="font-bold text-[var(--color-txt)]">{followerCount || 0}</span> <span className="text-[var(--color-txt2)]">Followers</span></div>
          <div><span className="font-bold text-[var(--color-txt)]">{followingCount || 0}</span> <span className="text-[var(--color-txt2)]">Following</span></div>
        </div>

        {!isOwnProfile && mutualFollowers?.length > 0 && (
          <div className="mt-2 text-sm text-[var(--color-txt2)]">🤝 {mutualFollowers.length} mutual follower{mutualFollowers.length !== 1 ? 's' : ''}</div>
        )}

        <div className="mt-6 border-b border-[var(--color-border)] flex gap-6">
          {['posts', 'about'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-2 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-accent)] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <p className="text-[var(--color-txt2)] text-center py-8">{isOwnProfile ? 'You haven’t posted yet.' : 'No posts yet.'}</p>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={(id) => console.log('Like post', id)}
                    onComment={(id) => console.log('Comment on post', id)}
                    onRepost={(id) => console.log('Repost', id)}
                    onShare={(id) => console.log('Share', id)}
                  />
                ))
              )}
              {postsHasMore && (
                <div ref={postsLoadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
                  {postsLoading ? 'Loading more…' : 'Load more'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-4 space-y-4">
              {bio && (
                <div>
                  <div className="font-semibold text-[var(--color-txt2)] text-sm">Bio</div>
                  <p className="text-[var(--color-txt)]">{bio}</p>
                </div>
              )}
              {aboutDetails.length > 0 && (
                <div>
                  <div className="font-semibold text-[var(--color-txt2)] text-sm mb-2">Details</div>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aboutDetails.map((detail) => (
                      <div key={detail.label} className="flex items-start gap-2">
                        <dt className="text-[var(--color-txt2)] text-sm min-w-[70px]">{detail.label}</dt>
                        <dd className="text-[var(--color-txt)] text-sm break-words">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {!bio && aboutDetails.length === 0 && <p className="text-[var(--color-txt2)] text-center py-4">No info added yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}