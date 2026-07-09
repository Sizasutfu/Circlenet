// src/components/ui/PostCard.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLightbox } from '@/hooks/useLightbox';
import { useAuth } from '@/lib/auth';
import { generatePostCard } from '@/lib/postCardGenerator';
import { useLive } from '@/contexts/LiveContext';
import { formatPostText } from '@/lib/formatText';
import { apiClient } from '@/lib/api';
import LikeButton from './LikeButton';
import CommentButton from './CommentButton';
import RepostButton from './RepostButton';
import ShareButton from './ShareButton';

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
  return `hsl(${hue}, 70%, 55%)`;
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

function timeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'just now';
  else if (minutes < 60) return `${minutes}m ago`;
  else if (hours < 24) return `${hours}h ago`;
  else if (days < 7) return `${days}d ago`;
  else if (weeks < 4) return `${weeks}w ago`;
  else if (months < 12) return `${months}mo ago`;
  else return `${years}y ago`;
}

function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(/(https?:\/\/[^\s]+)/);
  return match ? match[0] : null;
}

export default function PostCard({ 
  post, 
  onLike, 
  onComment, 
  onRepost, 
  onShare, 
  onQuote,
  groupMap = new Map()
}) {
  if (!post) return null;

  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { watchSession } = useLive();

  const {
    id,
    text,
    image,
    video,
    createdAt,
    likes = [],
    comments = [],
    reposts = [],
    shares = 0,
    viewCount = 0,
    isLive = false,
    liveSessionId = null,
    commentCount,
    repostCount,
    isRepost = false,
    originalPost = null,
    groupId = null,
  } = post;

  const groupInfo = groupId ? groupMap.get(groupId) : null;
  const groupTopic = groupInfo?.displayName || groupInfo?.topic || null;

  const displayName = post.user?.name || post.author || 'Anonymous';
  const username = post.user?.username || post.authorUsername || post.username || '';
  const avatarUrl = resolveMediaUrl(post.user?.picture || post.authorPicture || null);

  const initialLiked = currentUser && likes.length > 0
    ? likes.some(id => id === currentUser.id)
    : false;

  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(likes.length || 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const { openLightbox } = useLightbox();
  const videoRef = useRef(null);

  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = stringToColor(displayName);
  const relativeTime = createdAt ? timeAgo(createdAt) : '';

  // ── Fetch link preview ──
  useEffect(() => {
    if (image || video) return;
    if (!text) return;
    const url = extractFirstUrl(text);
    if (!url) return;

    setPreviewLoading(true);
    setPreviewError(false);

    apiClient(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => {
        const data = res.data || res;
        if (data && (data.title || data.description || data.image)) {
          setPreviewData(data);
        } else {
          setPreviewError(true);
        }
      })
      .catch(() => setPreviewError(true))
      .finally(() => setPreviewLoading(false));
  }, [id, text, image, video]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    if (onLike) onLike(id);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);
  const shouldTruncate = text?.length > 200 && !isExpanded;

  const postImageUrl = resolveMediaUrl(image);
  const postVideoUrl = resolveMediaUrl(video);

  // ── Image click: open lightbox with metadata ──
  const handleImageClick = (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (postImageUrl) {
    const imageItem = {
      src: postImageUrl,
      type: 'image',
      meta: {
        postId: id,
        caption: text || '',
        name: displayName,
        username: username || undefined,
        userId: post.user?.id || post.authorId || post.userId,
        picture: avatarUrl,
      },
    };
    openLightbox([imageItem], 0);
  }
};

  // ── Video double-click: open lightbox with metadata ──
  const handleVideoDblClick = (e) => {
  e.stopPropagation();
  if (postVideoUrl) {
    const videoItem = {
      src: postVideoUrl,
      type: 'video',
      meta: {
        postId: id,
        caption: text || '',
        name: displayName,
        username: username || undefined,
        userId: post.user?.id || post.authorId || post.userId,
        picture: avatarUrl,
        poster: postImageUrl || undefined,
      },
    };
    openLightbox([videoItem], 0);
  }
};

  const handleVideoError = () => {
    console.warn('⚠️ Video failed to load:', postVideoUrl);
    setVideoError(true);
  };

  const handleDownloadPostImage = async () => {
    if (imageLoading) return;
    setImageLoading(true);
    setIsDropdownOpen(false);
    try {
      const canvas = await generatePostCard(post, currentUser?.username);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `post-${id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating post image:', err);
      alert('Failed to generate image.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleSharePostImage = async () => {
    if (imageLoading) return;
    setImageLoading(true);
    setIsDropdownOpen(false);
    try {
      const canvas = await generatePostCard(post, currentUser?.username);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `post-${id}.png`, { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({
          title: 'Check this post',
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `post-${id}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing post image:', err);
        alert('Failed to share image.');
      }
    } finally {
      setImageLoading(false);
    }
  };

  const handleDownloadOriginalImage = () => {
    if (!postImageUrl) return;
    setIsDropdownOpen(false);
    const link = document.createElement('a');
    link.href = postImageUrl;
    link.download = `post-image-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditPost = () => {
    setIsDropdownOpen(false);
    router.push(`/edit-post/${id}`);
  };

  const handleLiveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (liveSessionId) {
      watchSession(liveSessionId);
    }
  };

  const goToPost = (e) => {
    const target = e.target;
    if (target.closest('a') || target.closest('button') || target.closest('.dm-engagement-btn')) {
      return;
    }
    router.push(`/post/${id}`);
  };

  // ── Render media (image or video) ──
  const renderMedia = () => {
    if (postVideoUrl) {
      return (
        <div
          className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border)] bg-black/5 relative cursor-pointer"
          onDoubleClick={handleVideoDblClick}
        >
          {videoError ? (
            <div className="p-6 text-center text-[var(--color-txt2)] text-sm">
              <svg className="w-10 h-10 mx-auto mb-2 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Video failed to load</p>
              <a href={postVideoUrl} target="_blank" rel="noopener" className="text-[var(--color-accent)] hover:underline text-xs">
                View directly
              </a>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={postVideoUrl}
                controls
                playsInline
                className="w-full h-auto max-h-96 object-contain"
                poster={postImageUrl || undefined}
                onError={handleVideoError}
                preload="metadata"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                Expand
              </div>
            </>
          )}
        </div>
      );
    }

    if (postImageUrl) {
      return (
        <div className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border)]">
          <img
            src={postImageUrl}
            alt="Post image"
            className="w-full h-auto max-h-96 object-cover cursor-pointer hover:opacity-90 transition"
            onClick={handleImageClick}
          />
        </div>
      );
    }

    return null;
  };

  // ── Render link preview ──
  const renderLinkPreview = () => {
    if (postImageUrl || postVideoUrl) return null;
    if (previewLoading) {
      return (
        <div className="mt-3 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] animate-pulse">
          <div className="h-4 w-3/4 bg-[var(--color-border)] rounded" />
          <div className="h-3 w-1/2 bg-[var(--color-border)] rounded mt-2" />
        </div>
      );
    }
    if (previewError || !previewData || !previewData.title) return null;
    const { title, description, image: previewImage, siteName } = previewData;
    const imgUrl = resolveMediaUrl(previewImage);
    const url = extractFirstUrl(text);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block border border-[var(--color-border)] rounded-lg overflow-hidden hover:shadow-[var(--color-shadow)] transition-shadow cursor-pointer group"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row">
          {imgUrl && (
            <div className="sm:w-36 h-24 sm:h-auto flex-shrink-0 bg-[var(--color-surface)]">
              <img src={imgUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div className="flex-1 p-3 min-w-0">
            <div className="text-sm font-semibold text-[var(--color-txt)] group-hover:text-[var(--color-accent)] transition line-clamp-2">
              {title}
            </div>
            {description && (
              <div className="text-xs text-[var(--color-txt2)] mt-1 line-clamp-2">
                {description}
              </div>
            )}
            {siteName && (
              <div className="text-xs text-[var(--color-txt3)] mt-2">
                {siteName}
              </div>
            )}
          </div>
        </div>
      </a>
    );
  };

  const isAuthor = currentUser && (post.user?.id === currentUser.id || post.authorId === currentUser.id);

  // ── Profile URL ──
  const userId = post.user?.id || post.authorId || post.userId;
  const usernameForProfile = post.user?.username || post.authorUsername || post.username;
  const profileUrl = usernameForProfile ? `/profile/${usernameForProfile}` : (userId ? `/profile?userId=${userId}` : null);

  // ── Render group badge ──
  const renderGroupBadge = () => {
    if (!groupId || !groupTopic) return null;
    return (
      <Link
        href={`/groups/${groupId}`}
        className="ml-2 text-xs bg-[var(--color-accent-bg)] text-[var(--color-accent)] px-2 py-0.5 rounded-full hover:underline transition"
        onClick={(e) => e.stopPropagation()}
      >
        {groupTopic}
      </Link>
    );
  };

  // ── View count badge ──
  const renderViewCount = () => {
    if (!viewCount || viewCount <= 0) return null;
    return (
      <span className="flex items-center gap-1 text-[var(--color-txt3)]" title="Total views">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {formatNumber(viewCount)}
      </span>
    );
  };

  // ── Render original post as embedded card ──
  const renderOriginalPost = () => {
    if (!originalPost) return null;
    const origAuthor = originalPost.author || 'Unknown';
    const origUsername = originalPost.username || '';
    const origAvatar = originalPost.authorPicture || '';
    const origText = originalPost.text || '';
    const origImage = originalPost.image || '';
    const origVideo = originalPost.video || '';
    const origCreated = originalPost.createdAt || new Date().toISOString();

    const origInitial = origAuthor.charAt(0).toUpperCase();
    const origColor = stringToColor(origAuthor);
    const origAvatarUrl = resolveMediaUrl(origAvatar);
    const origRelativeTime = timeAgo(origCreated);
    const origImageUrl = resolveMediaUrl(origImage);
    const origVideoUrl = resolveMediaUrl(origVideo);

    return (
      <div
        className="mt-2 border-l-4 border-l-[var(--color-accent)] pl-3 bg-[var(--color-surface)] rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden"
              style={{ background: origAvatarUrl ? 'transparent' : origColor }}
            >
              {origAvatarUrl ? (
                <img src={origAvatarUrl} alt={origInitial} className="w-full h-full object-cover" />
              ) : (
                origInitial
              )}
            </div>
            <span className="font-semibold text-xs text-[var(--color-txt)]">
              {origAuthor}
            </span>
            {origUsername && (
              <span className="text-xs text-[var(--color-txt2)]">@{origUsername}</span>
            )}
            <span className="text-xs text-[var(--color-txt3)]">· {origRelativeTime}</span>
          </div>
          {origText && (
            <div className="text-sm text-[var(--color-txt)] mt-1 break-words line-clamp-3">
              <span dangerouslySetInnerHTML={{ __html: formatPostText(origText) }} />
            </div>
          )}
          {(origImageUrl || origVideoUrl) && (
            <div className="mt-2 rounded-lg overflow-hidden border border-[var(--color-border)] max-h-40">
              {origVideoUrl ? (
                <video src={origVideoUrl} controls playsInline className="w-full h-auto max-h-32 object-contain" />
              ) : (
                <img src={origImageUrl} alt="Original post image" className="w-full h-auto max-h-32 object-cover" />
              )}
            </div>
          )}
          <Link
            href={`/post/${originalPost.id}`}
            className="text-xs text-[var(--color-accent)] hover:underline mt-1 block"
            onClick={(e) => e.stopPropagation()}
          >
            View original post →
          </Link>
        </div>
      </div>
    );
  };

  // ── Repost layout ──
  if (isRepost && originalPost) {
    return (
      <div className="p-4 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] hover:shadow-[var(--color-shadow)] transition-shadow duration-200">
        <div className="flex items-start gap-3">
          {profileUrl ? (
            <Link href={profileUrl} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ background: avatarUrl ? 'transparent' : avatarColor }}
              >
                {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
              </div>
            </Link>
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: avatarUrl ? 'transparent' : avatarColor }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition"
                    onClick={(e) => e.stopPropagation()}
                    title="View profile"
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm">{displayName}</span>
                )}
                {username && (
                  profileUrl ? (
                    <Link
                      href={profileUrl}
                      className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  )
                )}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>

              <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                  className="p-1 text-[var(--color-txt3)] hover:text-[var(--color-txt)] rounded-full hover:bg-[var(--color-accent-bg)] transition"
                  title="More actions"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="18" r="2" />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[170px] z-20">
                    <button
                      onClick={handleDownloadPostImage}
                      disabled={imageLoading}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                      </svg>
                      {imageLoading ? 'Generating…' : 'Download as Image'}
                    </button>
                    <button
                      onClick={handleSharePostImage}
                      disabled={imageLoading}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      </svg>
                      Share as Image
                    </button>
                    {postImageUrl && (
                      <>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        <button
                          onClick={handleDownloadOriginalImage}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download Original
                        </button>
                      </>
                    )}
                    {isAuthor && (
                      <>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        <button
                          onClick={handleEditPost}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          Edit Post
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {text && (
              <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
              </div>
            )}

            {renderOriginalPost()}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--color-txt2)] text-xs">
              <LikeButton count={likeCount} active={isLiked} onToggle={handleLike} />
              <CommentButton count={commentCount ?? comments.length} onClick={() => onComment && onComment(id)} />
              <RepostButton count={repostCount ?? reposts.length} onClick={() => onRepost && onRepost(id)} />
              <button
                onClick={(e) => { e.stopPropagation(); if (onQuote) onQuote(id); }}
                className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
                title="Quote this post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
                </svg>
              </button>
              <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
              {renderViewCount()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Live post layout ──
  if (isLive && liveSessionId) {
    return (
      <div
        className="p-4 rounded-[var(--radius-radius-sm)] border border-[var(--color-rose)] hover:shadow-[var(--color-shadow)] transition-shadow duration-200 cursor-pointer bg-[var(--color-rose-bg)]"
        onClick={handleLiveClick}
      >
        <div className="flex items-start gap-3">
          {profileUrl ? (
            <Link href={profileUrl} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ background: avatarUrl ? 'transparent' : avatarColor }}
              >
                {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
              </div>
            </Link>
          ) : (
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: avatarUrl ? 'transparent' : avatarColor }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link href={profileUrl} onClick={(e) => e.stopPropagation()} className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition">
                    {displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm">{displayName}</span>
                )}
                {username && (
                  profileUrl ? (
                    <Link href={profileUrl} onClick={(e) => e.stopPropagation()} className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition">
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  )
                )}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>
              <span className="flex items-center gap-1 bg-[var(--color-rose)] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
              <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 bg-black/10 dark:bg-white/10 rounded-lg p-3">
              <svg className="w-8 h-8 text-[var(--color-rose)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10,8 16,12 10,16" fill="currentColor" />
              </svg>
              <span className="text-sm font-semibold text-[var(--color-rose)]">Tap to watch live</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--color-txt2)] text-xs">
              <LikeButton count={likeCount} active={isLiked} onToggle={handleLike} />
              <CommentButton count={commentCount ?? comments.length} onClick={() => onComment && onComment(id)} />
              <RepostButton count={repostCount ?? reposts.length} onClick={() => onRepost && onRepost(id)} />
              <button
                onClick={(e) => { e.stopPropagation(); if (onQuote) onQuote(id); }}
                className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
                title="Quote this post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
                </svg>
              </button>
              <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
              {renderViewCount()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular post layout ──
  return (
    <div className="p-4 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] hover:shadow-[var(--color-shadow)] transition-shadow duration-200">
      <div className="flex items-start gap-3">
        {profileUrl ? (
          <Link href={profileUrl} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: avatarUrl ? 'transparent' : avatarColor }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
            </div>
          </Link>
        ) : (
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
            style={{ background: avatarUrl ? 'transparent' : avatarColor }}
          >
            {avatarUrl ? <img src={avatarUrl} alt={initial} className="h-full w-full rounded-full object-cover" /> : initial}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="block cursor-pointer" onClick={goToPost}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition"
                    onClick={(e) => e.stopPropagation()}
                    title="View profile"
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm">{displayName}</span>
                )}
                {username && (
                  profileUrl ? (
                    <Link
                      href={profileUrl}
                      className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  )
                )}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>

              <div className="relative flex-shrink-0" ref={dropdownRef}>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                  className="p-1 text-[var(--color-txt3)] hover:text-[var(--color-txt)] rounded-full hover:bg-[var(--color-accent-bg)] transition"
                  title="More actions"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="6" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="18" r="2" />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[170px] z-20">
                    <button
                      onClick={handleDownloadPostImage}
                      disabled={imageLoading}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                      </svg>
                      {imageLoading ? 'Generating…' : 'Download as Image'}
                    </button>
                    <button
                      onClick={handleSharePostImage}
                      disabled={imageLoading}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      </svg>
                      Share as Image
                    </button>
                    {postImageUrl && (
                      <>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        <button
                          onClick={handleDownloadOriginalImage}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Download Original
                        </button>
                      </>
                    )}
                    {isAuthor && (
                      <>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        <button
                          onClick={handleEditPost}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          Edit Post
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
              {shouldTruncate ? (
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text.slice(0, 200) + '…') }} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
              )}
              {text?.length > 200 && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpand(); }}
                  className="ml-1 text-[var(--color-accent)] hover:underline text-xs font-medium"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>

            {renderMedia()}
            {renderLinkPreview()}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--color-txt2)] text-xs">
            <LikeButton count={likeCount} active={isLiked} onToggle={handleLike} />
            <CommentButton count={commentCount ?? comments.length} onClick={() => onComment && onComment(id)} />
            <RepostButton count={repostCount ?? reposts.length} onClick={() => onRepost && onRepost(id)} />
            <button
              onClick={(e) => { e.stopPropagation(); if (onQuote) onQuote(id); }}
              className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
              title="Quote this post"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
              </svg>
            </button>
            <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
            {renderViewCount()}
          </div>
        </div>
      </div>
    </div>
  );
}