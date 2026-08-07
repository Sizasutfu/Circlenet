// src/app/admin/posts/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

// ─── Icons (All SVG, No Emojis) ──────────────────────────────────────

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const MoreVerticalIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="22 3 2 3 10 13 10 21 14 18 14 13 22 3" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const VideoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const RepostIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);

const CommentIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const RepostCountIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);

const ViewIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EmptyPostsIcon = () => (
  <svg className="w-12 h-12 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

// ─── Components ─────────────────────────────────────────────────────────

function MediaBadge({ type }) {
  if (!type) return null;
  
  const variants = {
    image: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    video: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    repost: 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  const icons = {
    image: <ImageIcon />,
    video: <VideoIcon />,
    repost: <RepostIcon />,
  };

  const labels = {
    image: 'Image',
    video: 'Video',
    repost: 'Repost',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${variants[type] || ''}`}>
      {icons[type]}
      {labels[type]}
    </span>
  );
}

// ─── Mobile Post Card ───────────────────────────────────────────────────

function MobilePostCard({ post, onAction }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleAction = (action, data) => {
    setDropdownOpen(false);
    onAction(action, data);
  };

  const truncateText = (text, max = 80) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const mediaType = post.video ? 'video' : post.image ? 'image' : null;
  const isRepost = post.isRepost || false;

  return (
    <div className="border-b border-[var(--color-border)] p-4 hover:bg-[var(--color-surface)] transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Post content */}
          <div className="text-sm text-[var(--color-txt)] line-clamp-2">
            {truncateText(post.text)}
          </div>
          
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {mediaType && <MediaBadge type={mediaType} />}
            {isRepost && <MediaBadge type="repost" />}
            <span className="text-xs text-[var(--color-txt3)]">
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          {/* Author */}
          <div className="mt-2">
            <Link 
              href={`/profile/${post.authorUsername || post.authorId}`}
              className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
              onClick={(e) => e.stopPropagation()}
            >
              {post.author}
            </Link>
            <span className="text-xs text-[var(--color-txt2)] ml-1">@{post.authorUsername || 'unknown'}</span>
          </div>
          
          {/* Engagement stats */}
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-txt2)]">
            <span className="flex items-center gap-1">
              <span className="text-rose-500 font-medium">{post.likeCount || 0}</span>
              <HeartIcon />
            </span>
            <span className="flex items-center gap-1">
              <span className="text-blue-500 font-medium">{post.commentCount || 0}</span>
              <CommentIcon />
            </span>
            <span className="flex items-center gap-1">
              <span className="text-green-500 font-medium">{post.repostCount || 0}</span>
              <RepostCountIcon />
            </span>
            <span className="flex items-center gap-1">
              {post.viewCount || 0}
              <ViewIcon />
            </span>
          </div>
        </div>
        
        {/* Actions dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={toggleDropdown}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
          >
            <MoreVerticalIcon />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
              <button
                onClick={() => handleAction('view', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <EyeIcon />
                View Post
              </button>
              <button
                onClick={() => handleAction('view_author', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <UserIcon />
                View Author
              </button>
              <div className="border-t border-[var(--color-border)] my-1" />
              <button
                onClick={() => handleAction('delete', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
              >
                <TrashIcon />
                Delete Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Post Row ──────────────────────────────────────────────────

function DesktopPostRow({ post, onAction }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleAction = (action, data) => {
    setDropdownOpen(false);
    onAction(action, data);
  };

  const truncateText = (text, max = 60) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const mediaType = post.video ? 'video' : post.image ? 'image' : null;
  const isRepost = post.isRepost || false;

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-[var(--color-txt)] line-clamp-2">
            {truncateText(post.text)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mediaType && <MediaBadge type={mediaType} />}
            {isRepost && <MediaBadge type="repost" />}
            <span className="text-xs text-[var(--color-txt3)]">
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link 
            href={`/profile/${post.authorUsername || post.authorId}`}
            className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
            onClick={(e) => e.stopPropagation()}
          >
            {post.author}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{post.authorUsername || 'unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-[var(--color-txt2)]">
            <span className="text-rose-500 font-medium">{post.likeCount || 0}</span>
            <HeartIcon />
          </span>
          <span className="flex items-center gap-1 text-[var(--color-txt2)]">
            <span className="text-blue-500 font-medium">{post.commentCount || 0}</span>
            <CommentIcon />
          </span>
          <span className="flex items-center gap-1 text-[var(--color-txt2)]">
            <span className="text-green-500 font-medium">{post.repostCount || 0}</span>
            <RepostCountIcon />
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className="flex items-center justify-center gap-1 text-sm text-[var(--color-txt2)]">
          {post.viewCount || 0}
          <ViewIcon />
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
          >
            <MoreVerticalIcon />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[180px]">
              <button
                onClick={() => handleAction('view', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <EyeIcon />
                View Post
              </button>
              <button
                onClick={() => handleAction('view_author', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <UserIcon />
                View Author
              </button>
              <div className="border-t border-[var(--color-border)] my-1" />
              <button
                onClick={() => handleAction('delete', post)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
              >
                <TrashIcon />
                Delete Post
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-head font-bold text-[var(--color-txt)]">{title}</h3>
        <p className="text-sm text-[var(--color-txt2)] mt-2">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:bg-[var(--color-surface)] transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
              danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-h)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export default function AdminPostsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    action: null,
    post: null,
    title: '',
    message: '',
    confirmText: '',
    danger: false,
  });

  useEffect(() => {
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/posts?page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await apiClient(url, { admin: true });
      const data = response.data || response;

      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        localStorage.removeItem('circle_admin_token');
        localStorage.removeItem('circle_admin');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, router]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleAction = async (action, postData) => {
    if (action === 'view') {
      router.push(`/post/${postData.id}`);
      return;
    }

    if (action === 'view_author') {
      router.push(`/admin/users/${postData.userId}`);
      return;
    }

    if (action === 'delete') {
      setDialog({
        isOpen: true,
        action,
        post: postData,
        title: 'Delete Post',
        message: `Are you sure you want to permanently delete this post by "${postData.author}"? This action cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      });
      return;
    }
  };

  const confirmAction = async () => {
    const { action, post } = dialog;
    setDialog({ ...dialog, isOpen: false });

    if (action === 'delete') {
      try {
        await apiClient(`/api/admin/posts/${post.id}`, { method: 'DELETE', admin: true });
        fetchPosts();
      } catch (err) {
        console.error('Failed to delete post:', err);
        alert('Failed to delete post: ' + err.message);
      }
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loading && posts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Manage Posts</h1>
          <p className="text-sm text-[var(--color-txt2)]">{total.toLocaleString()} total posts</p>
        </div>
        <button
          onClick={fetchPosts}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition"
        >
          <RefreshCwIcon />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-txt3)]">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search posts by text or author name..."
              className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
          >
            <FilterIcon />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <label className="block text-xs text-[var(--color-txt2)] mb-1">Media Type</label>
              <select
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
              >
                <option value="">All</option>
                <option value="image">With Images</option>
                <option value="video">With Videos</option>
                <option value="text">Text Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--color-txt2)] mb-1">Sort By</label>
              <select
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="most_liked">Most Liked</option>
                <option value="most_commented">Most Commented</option>
                <option value="most_reposted">Most Reposted</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Post</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Author</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Engagement</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Views</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-[var(--color-txt2)]">
                    <div className="flex flex-col items-center gap-2">
                      <EmptyPostsIcon />
                      <p>No posts found</p>
                      <p className="text-sm text-[var(--color-txt3)]">Try adjusting your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <DesktopPostRow
                    key={p.id}
                    post={p}
                    onAction={handleAction}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="md:hidden bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {posts.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--color-txt2)]">
            <div className="flex flex-col items-center gap-2">
              <EmptyPostsIcon />
              <p>No posts found</p>
              <p className="text-sm text-[var(--color-txt3)]">Try adjusting your search</p>
            </div>
          </div>
        ) : (
          posts.map((p) => (
            <MobilePostCard
              key={p.id}
              post={p}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 mt-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]">
          <div className="text-sm text-[var(--color-txt2)]">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    p === page
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            {totalPages > 5 && page < totalPages - 2 && (
              <>
                <span className="px-2 py-1 text-[var(--color-txt3)]">…</span>
                <button
                  onClick={() => setPage(totalPages)}
                  className="px-3 py-1 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        onConfirm={confirmAction}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        danger={dialog.danger}
      />
    </div>
  );
}