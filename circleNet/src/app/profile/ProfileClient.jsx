// src/app/profile/ProfileClient.jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';
import QuoteModal from '@/components/ui/QuoteModal';
import { useLightbox } from '@/hooks/useLightbox';
import { useDm } from '@/contexts/DmContext';

// ── Helpers ──
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

// ─── Uniform avatar placeholder ──────────────────────────
function AvatarPlaceholder({ size = 'w-10 h-10', className = '' }) {
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center ${size} ${className}`}
    >
      <svg
        className="w-1/2 h-1/2 text-[var(--color-txt3)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

// ── Profile cache ──
const profileCache = new Map();

function getCacheKey(username, userId) {
  return username || `user-${userId}`;
}

function getCachedProfile(key) {
  const entry = profileCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > 60000) {
    profileCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedProfile(key, data) {
  profileCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// ── User list modal ──
function UserListModal({ title, users, onClose, isLoading }) {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const handleUserClick = (user) => {
    onClose();
    if (user.id === currentUser?.id) {
      router.push('/profile');
    } else if (user.username) {
      router.push(`/profile/${user.username}`);
    } else {
      router.push(`/profile?userId=${user.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="font-head font-bold text-[var(--color-txt)]">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-[var(--color-txt2)] py-8">No {title.toLowerCase()} yet.</p>
          ) : (
            users.map((user) => {
              const avatarUrl = resolveMediaUrl(user.picture);
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 hover:bg-[var(--color-surface)] rounded-xl cursor-pointer transition"
                  onClick={() => handleUserClick(user)}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={user.name || 'User'}
                      className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <AvatarPlaceholder size="w-10 h-10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-txt)] text-sm">{user.name}</div>
                    <div className="text-xs text-[var(--color-txt2)]">@{user.username}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Toast ──
function Toast({ message, type }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${type === 'error' ? 'bg-[var(--color-rose)]' : 'bg-[var(--color-green)]'}`}>
      {message}
    </div>
  );
}

export default function ProfileClient({ username = null, initialUser = null }) {
  const { user: currentUser, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openLightbox } = useLightbox();
  const { startConversation } = useDm();
  const userIdParam = searchParams?.get('userId') ? parseInt(searchParams.get('userId')) : null;
  const isOwnProfile = !username && !userIdParam && currentUser;
  const profileKey = getCacheKey(username, userIdParam || currentUser?.id);

  // ── State (initialized from cache if available) ──
  const cached = getCachedProfile(profileKey);

  const [profile, setProfile] = useState(cached?.profile || initialUser || null);
  const [loading, setLoading] = useState(!profile && !initialUser);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState(cached?.posts || []);
  const [postsPage, setPostsPage] = useState(cached?.page || 1);
  const [postsHasMore, setPostsHasMore] = useState(cached?.hasMore || false);
  const [postsLoading, setPostsLoading] = useState(false);
  const postsLoadMoreRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [listModal, setListModal] = useState({ open: false, type: '', users: [], isLoading: false });

  // ── Quote modal state ──
  const [quoteTarget, setQuoteTarget] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Refs ──
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // ── Fetch profile ──
  useEffect(() => {
    if (initialUser) {
      setProfile(initialUser);
      setLoading(false);
      setCachedProfile(profileKey, { profile: initialUser, posts, page: postsPage, hasMore: postsHasMore });
      return;
    }

    if (cached && cached.profile) {
      setProfile(cached.profile);
      setPosts(cached.posts || []);
      setPostsPage(cached.page || 1);
      setPostsHasMore(cached.hasMore || false);
      setLoading(false);
      return;
    }

    let endpoint;
    if (username) {
      endpoint = `/api/users/by-username/${username}`;
    } else if (userIdParam) {
      endpoint = `/api/users/${userIdParam}/profile`;
    } else if (currentUser) {
      endpoint = `/api/users/${currentUser.id}/profile`;
    } else {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient(endpoint);
        const profileData = res.data || res;
        setProfile(profileData);
        setCachedProfile(profileKey, { profile: profileData, posts: [], page: 1, hasMore: false });
      } catch (err) {
        console.error('[Profile] Error:', err);
        setError(err.message || 'Failed to load profile');
        if (err.message?.includes('404') && username) {
          router.push('/feed');
        }
      } finally {
        setLoading(false);
      }
    };

    const profileId = profile?.id;
    const targetId = userIdParam || currentUser?.id;
    if (profileId && (profileId === targetId || profile.username === username)) {
      setLoading(false);
      return;
    }

    fetchProfile();
  }, [username, userIdParam, currentUser, initialUser, router, profileKey, cached]);

  // ── Fetch posts ──
  const fetchPosts = useCallback(async (page = 1, append = false) => {
    const currentProfile = profileRef.current;
    if (!currentProfile || postsLoading) return;
    setPostsLoading(true);
    try {
      const res = await apiClient(`/api/posts?userId=${currentProfile.id}&page=${page}&limit=20`);
      const postsData = res.data?.posts || [];
      const hasMore = res.data?.hasMore || postsData.length === 20;
      const newPosts = append ? [...posts, ...postsData] : postsData;
      setPosts(newPosts);
      setPostsHasMore(hasMore);
      setPostsPage(page);
      const currentCache = getCachedProfile(profileKey) || { profile: currentProfile };
      setCachedProfile(profileKey, {
        profile: currentCache.profile || currentProfile,
        posts: newPosts,
        page,
        hasMore,
      });
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setPostsLoading(false);
    }
  }, [postsLoading, posts, profileKey]);

  useEffect(() => {
    if (profile && !cached?.posts && !posts.length) {
      fetchPosts(1, false);
    }
  }, [profile, fetchPosts, cached, posts.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && postsHasMore && !postsLoading) {
          fetchPosts(postsPage + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    if (postsLoadMoreRef.current) {
      observer.observe(postsLoadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [postsHasMore, postsLoading, postsPage, fetchPosts]);

  // ── Post interactions ──
  const handleLike = async (postId) => {
    if (!currentUser) {
      showToast('Log in to like.', 'error');
      return;
    }
    // Optimistic update
    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    const post = posts[postIndex];
    const isLiked = post.likes?.includes(currentUser.id);
    const newLikes = isLiked
      ? post.likes.filter(id => id !== currentUser.id)
      : [...(post.likes || []), currentUser.id];
    const newPosts = [...posts];
    newPosts[postIndex] = { ...post, likes: newLikes };
    setPosts(newPosts);

    try {
      await apiClient(`/api/posts/${postId}/like`, { method: 'POST' });
    } catch (_) {
      // Revert on error
      const revert = [...posts];
      setPosts(revert);
      showToast('Failed to like.', 'error');
    }
  };

  const handleComment = (postId) => {
    if (!currentUser) {
      showToast('Please log in to comment.', 'error');
      return;
    }
    router.push(`/post/${postId}`);
  };

  const handleRepost = async (postId) => {
    if (!currentUser) {
      showToast('Log in to repost.', 'error');
      return;
    }
    try {
      await apiClient(`/api/posts/${postId}/repost`, { method: 'POST' });
      showToast('Reposted! 🔁', 'success');
      // Update repost count locally
      const postIndex = posts.findIndex(p => p.id === postId);
      if (postIndex !== -1) {
        const newPosts = [...posts];
        newPosts[postIndex] = {
          ...newPosts[postIndex],
          repostCount: (newPosts[postIndex].repostCount || 0) + 1,
        };
        setPosts(newPosts);
      }
    } catch (_) {
      showToast('Failed to repost.', 'error');
    }
  };

  const handleShare = (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    if (navigator.share) {
      navigator.share({ title: 'Check this post', url });
    } else {
      navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success'));
    }
  };

  const handleQuote = (postId) => {
    if (!currentUser) {
      showToast('Please log in to quote.', 'error');
      return;
    }
    const post = posts.find(p => p.id === postId);
    if (post) setQuoteTarget(post);
  };

  const handleQuoteSuccess = () => {
    setQuoteTarget(null);
    showToast('Quoted successfully! 🎉', 'success');
    fetchPosts(1, false); // refresh feed
  };

  // ── Follow ──
  const handleFollowToggle = async () => {
    if (!currentUser || !profile) return;
    const following = profile.isFollowing;
    const method = following ? 'DELETE' : 'POST';
    const endpoint = following ? `/api/unfollow/${profile.id}` : `/api/follow/${profile.id}`;
    try {
      await apiClient(endpoint, { method });
      const newProfile = {
        ...profile,
        isFollowing: !profile.isFollowing,
        followerCount: profile.isFollowing ? (profile.followerCount || 0) - 1 : (profile.followerCount || 0) + 1,
      };
      setProfile(newProfile);
      const currentCache = getCachedProfile(profileKey) || {};
      setCachedProfile(profileKey, {
        ...currentCache,
        profile: newProfile,
      });
    } catch (err) {
      console.error('Follow action failed:', err);
      showToast('Failed to follow/unfollow.', 'error');
    }
  };

  // ── Avatar & Cover upload ──
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !isOwnProfile) {
      showToast('You can only change your own avatar.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      await apiClient(`/api/users/${currentUser.id}/picture`, {
        method: 'PUT',
        body: formData,
      });
      const refetch = await apiClient(`/api/users/${currentUser.id}/profile`);
      const newProfile = refetch.data || refetch;
      setProfile(newProfile);
      const currentCache = getCachedProfile(profileKey) || {};
      setCachedProfile(profileKey, {
        ...currentCache,
        profile: newProfile,
      });
      showToast('Avatar updated! 📸');
    } catch (err) {
      console.error('Avatar upload error:', err);
      showToast('Failed to upload avatar: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser || !isOwnProfile) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB.', 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      await apiClient(`/api/users/${currentUser.id}/cover`, {
        method: 'PUT',
        body: formData,
      });
      const refetch = await apiClient(`/api/users/${currentUser.id}/profile`);
      const newProfile = refetch.data || refetch;
      setProfile(newProfile);
      const currentCache = getCachedProfile(profileKey) || {};
      setCachedProfile(profileKey, {
        ...currentCache,
        profile: newProfile,
      });
      showToast('Cover updated! 🖼️');
    } catch (err) {
      console.error('Cover upload error:', err);
      showToast('Failed to upload cover: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // ── User list modal ──
  const openUserList = async (type) => {
    if (!profile) return;
    setListModal({ open: true, type, users: [], isLoading: true });
    try {
      const endpoint = `/api/users/${profile.id}/${type}`;
      const res = await apiClient(endpoint);
      const users = res.data || [];
      setListModal({ open: true, type, users, isLoading: false });
    } catch (err) {
      console.error('Failed to fetch', type, err);
      setListModal({ open: true, type, users: [], isLoading: false });
    }
  };

  const closeListModal = () => {
    setListModal({ open: false, type: '', users: [], isLoading: false });
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error || 'Profile not found.'}</p>
        <button
          onClick={() => router.push('/feed')}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  const {
    name,
    username: profileUsername,
    bio,
    picture,
    coverImage,
    location,
    website,
    joined,
    school,
    occupation,
    gender,
    phone,
    dateOfBirth,
    postCount,
    followerCount,
    followingCount,
    isFollowing,
    mutualFollowers,
  } = profile;

  const avatarUrl = resolveMediaUrl(picture);
  const coverUrl = resolveMediaUrl(coverImage);
  const initial = name?.charAt(0)?.toUpperCase() || '?';
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

  return (
    <div className="max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Cover and Avatar ── */}
      <div className="relative">
        <div className="h-48 md:h-64 rounded-[var(--radius-radius)] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group">
          {coverUrl ? (
            <div
              className="relative w-full h-full cursor-pointer"
              onClick={() => openLightbox([coverUrl], 0)}
            >
              <img
                src={coverUrl}
                alt="Cover"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                <span className="bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View full image
                </span>
              </div>
            </div>
          ) : (
            // ─── Fallback cover: static gradient using theme colors ───
            <div className="w-full h-full bg-gradient-to-r from-[var(--color-accent)]/30 to-[var(--color-accent)]/60" />
          )}
          {isOwnProfile && (
            <label
              htmlFor="cover-upload"
              className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/70 transition z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Change Cover
              <input type="file" id="cover-upload" className="hidden" accept="image/*" onChange={handleCoverUpload} />
            </label>
          )}
        </div>

        {/* ── Avatar ── */}
        <div className="absolute -bottom-12 left-6 md:left-8 z-30">
          <div className="relative h-24 w-24 md:h-28 md:w-28">
            {avatarUrl ? (
              <div className="w-full h-full rounded-full border-4 border-[var(--color-card)] overflow-hidden shadow-lg shadow-[var(--color-shadow)]">
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-full rounded-full border-4 border-[var(--color-card)] shadow-lg shadow-[var(--color-shadow)]">
                <AvatarPlaceholder size="w-full h-full" />
              </div>
            )}
            {isOwnProfile && (
              <>
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 bg-[var(--color-accent)] rounded-full p-1.5 cursor-pointer hover:bg-[var(--color-accent-h)] transition shadow-md z-40"
                  onClick={(e) => e.stopPropagation()}
                  title="Change avatar"
                >
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <input
                    type="file"
                    id="avatar-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                </label>
                {avatarUrl && (
                  <button
                    onClick={() => openLightbox([avatarUrl], 0)}
                    className="absolute top-0 right-0 bg-black/40 rounded-full p-1.5 hover:bg-black/60 transition z-40"
                    title="View avatar"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="mt-16 px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-head font-bold text-[var(--color-txt)]">{name}</h1>
            <p className="text-[var(--color-txt2)]">@{profileUsername}</p>
            {bio && <p className="mt-2 text-[var(--color-txt2)] max-w-lg">{bio}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-txt3)]">
              {location && <span>📍 {location}</span>}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                  🔗 {website.replace(/^https?:\/\//, '')}
                </a>
              )}
              {joinDate && <span>📅 {joinDate}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwnProfile ? (
              <>
                <Link href="/settings" className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition text-sm font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit Profile
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-rose-bg)] hover:text-[var(--color-rose)] hover:border-[var(--color-rose)] transition text-sm font-medium flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleFollowToggle}
                  className={`px-4 py-2 rounded-[var(--radius-radius-sm)] text-sm font-medium transition ${
                    isFollowing
                      ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-accent)]'
                      : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] shadow-md shadow-[var(--color-accent-glow)]'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  onClick={() => {
                    startConversation(profile.id);
                    router.push('/messages');
                  }}
                  className="px-4 py-2 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-accent)] transition text-sm font-medium flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  Message
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-6 text-sm">
          <div><span className="font-bold text-[var(--color-txt)]">{postCount || 0}</span> <span className="text-[var(--color-txt2)]">Posts</span></div>
          <div
            className="cursor-pointer hover:text-[var(--color-accent)] transition"
            onClick={() => openUserList('followers')}
          >
            <span className="font-bold text-[var(--color-txt)]">{followerCount || 0}</span> <span className="text-[var(--color-txt2)]">Followers</span>
          </div>
          <div
            className="cursor-pointer hover:text-[var(--color-accent)] transition"
            onClick={() => openUserList('following')}
          >
            <span className="font-bold text-[var(--color-txt)]">{followingCount || 0}</span> <span className="text-[var(--color-txt2)]">Following</span>
          </div>
        </div>

        {!isOwnProfile && mutualFollowers && mutualFollowers.length > 0 && (
          <div className="mt-2 text-sm text-[var(--color-txt2)]">
            🤝 {mutualFollowers.length} mutual follower{mutualFollowers.length !== 1 ? 's' : ''}
          </div>
        )}

        <div className="mt-6 border-b border-[var(--color-border)] flex gap-6">
          {['posts', 'about'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-medium transition-all relative ${
                activeTab === tab ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-accent)] rounded-full" />}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === 'posts' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <p className="text-[var(--color-txt2)] text-center py-8">
                  {isOwnProfile ? 'You haven’t posted yet.' : 'No posts yet.'}
                </p>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={() => handleLike(post.id)}
                    onComment={() => handleComment(post.id)}
                    onRepost={() => handleRepost(post.id)}
                    onShare={() => handleShare(post.id)}
                    onQuote={() => handleQuote(post.id)}
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
              {!bio && aboutDetails.length === 0 && (
                <p className="text-[var(--color-txt2)] text-center py-4">No info added yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── User list modal ── */}
      {listModal.open && (
        <UserListModal
          title={listModal.type === 'followers' ? 'Followers' : 'Following'}
          users={listModal.users}
          isLoading={listModal.isLoading}
          onClose={closeListModal}
        />
      )}

      {/* ── Quote Modal ── */}
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