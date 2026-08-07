// src/components/ui/PostCard.jsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLightbox } from '@/hooks/useLightbox';
import { useAuth } from '@/lib/auth';
import { generatePostCard } from '@/lib/postCardGenerator';
import { useLive } from '@/contexts/LiveContext';
import { formatPostText, extractMentions } from '@/lib/formatText';
import { apiClient } from '@/lib/api';
import LikeButton from './LikeButton';
import CommentButton from './CommentButton';
import RepostButton from './RepostButton';
import ShareButton from './ShareButton';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import VerificationBadge from '@/components/ui/VerificationBadge';
import { resolveMediaUrl } from '@/lib/url';

let currentlyPlayingVideo = null;

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

const cardClasses =
  'px-4 py-3 border-b border-[var(--color-border)] hover:shadow-[var(--color-shadow)] transition-shadow duration-200';

export default function PostCard({
  post,
  onLike,
  onComment,
  onRepost,
  onShare,
  onQuote,
  groupMap = new Map(),
  showFollowButton = false,
  isFollowing = false,
  onFollowToggle = null,
  isMentioned = false,
}) {
  if (!post) return null;

  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { watchSession } = useLive();
  const { openLightbox } = useLightbox();

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
    views = 0,
    videoViews = 0,
    isLive = false,
    liveSessionId = null,
    commentCount,
    repostCount,
    isRepost = false,
    originalPost = null,
    groupId = null,
    reasons = [],
  } = post;

  const groupInfo = groupId ? groupMap.get(groupId) : null;
  const groupTopic = groupInfo?.displayName || groupInfo?.topic || null;

  const displayName = post.user?.name || post.author || 'Anonymous';
  const username = post.user?.username || post.authorUsername || post.username || '';
  const avatarUrl = resolveMediaUrl(post.user?.picture || post.authorPicture || null);
  const isVerified = post.user?.verified || post.authorVerified || false;

  const initialLiked =
    currentUser && likes.length > 0 ? likes.some((id) => id === currentUser.id) : false;
  
  const initialReposted =
    currentUser && reposts.length > 0 ? reposts.some((id) => id === currentUser.id) : false;

  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(likes.length || 0);
  const [isReposted, setIsReposted] = useState(initialReposted);
  const [repostCountState, setRepostCountState] = useState(reposts.length || 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [showReasons, setShowReasons] = useState(false);
  const reasonRef = useRef(null);

  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const videoViewRecorded = useRef(false);

  const [regularViewsState, setRegularViewsState] = useState(views || 0);
  const [videoViewsState, setVideoViewsState] = useState(videoViews || 0);

  const relativeTime = createdAt ? timeAgo(createdAt) : '';

  // ── Check if current user is mentioned in this post ──
  const isUserMentioned = useMemo(() => {
    if (!currentUser || !text) return false;
    const mentions = extractMentions(text);
    return mentions.some(m => m.toLowerCase() === currentUser.username?.toLowerCase());
  }, [text, currentUser]);

  // ── Pause other videos when this one starts playing ──
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handlePlay = () => {
      if (currentlyPlayingVideo && currentlyPlayingVideo !== videoEl) {
        currentlyPlayingVideo.pause();
      }
      currentlyPlayingVideo = videoEl;
    };

    const handlePause = () => {
      if (currentlyPlayingVideo === videoEl) {
        currentlyPlayingVideo = null;
      }
    };

    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);

    return () => {
      videoEl.removeEventListener('play', handlePlay);
      videoEl.removeEventListener('pause', handlePause);
      if (currentlyPlayingVideo === videoEl) {
        currentlyPlayingVideo = null;
      }
    };
  }, []);

  // ── Pause video when it leaves the viewport ──
  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            const videoEl = videoRef.current;
            if (videoEl && !videoEl.paused) {
              videoEl.pause();
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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

  // ── Record video view when 30% watched ──
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !currentUser) return;

    const handleTimeUpdate = () => {
      if (videoViewRecorded.current) return;
      const duration = videoEl.duration;
      if (!duration || isNaN(duration) || duration === Infinity) return;
      const percent = videoEl.currentTime / duration;
      if (percent >= 0.3) {
        videoViewRecorded.current = true;
        const watchedSeconds = videoEl.currentTime;
        apiClient(`/api/posts/${id}/video-view`, {
          method: 'POST',
          body: { watchedSeconds, duration },
        })
          .then((res) => {
            const data = res.data || res;
            if (typeof data.views === 'number') {
              setVideoViewsState(data.views);
            } else {
              setVideoViewsState((prev) => prev + 1);
            }
          })
          .catch((err) => console.warn('Failed to record video view:', err));
      }
    };

    videoEl.addEventListener('timeupdate', handleTimeUpdate);

    const handleEnded = () => {
      if (videoViewRecorded.current) return;
      const duration = videoEl.duration;
      if (!duration || isNaN(duration)) return;
      videoViewRecorded.current = true;
      apiClient(`/api/posts/${id}/video-view`, {
        method: 'POST',
        body: { watchedSeconds: duration, duration },
      })
        .then((res) => {
          const data = res.data || res;
          if (typeof data.views === 'number') {
            setVideoViewsState(data.views);
          } else {
            setVideoViewsState((prev) => prev + 1);
          }
        })
        .catch((err) => console.warn('Failed to record video view (ended):', err));
    };
    videoEl.addEventListener('ended', handleEnded);

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('ended', handleEnded);
    };
  }, [id, currentUser]);

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

  // ── Close reason popover on outside click ──
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (reasonRef.current && !reasonRef.current.contains(e.target)) {
        setShowReasons(false);
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

  const handleRepost = () => {
    setIsReposted(!isReposted);
    setRepostCountState((prev) => (isReposted ? prev - 1 : prev + 1));
    if (onRepost) onRepost(id);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);
  const shouldTruncate = text?.length > 200 && !isExpanded;

  const postImageUrl = resolveMediaUrl(image);
  const postVideoUrl = resolveMediaUrl(video);

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
          userId: post.user?.id || post.authorId || post.userId,
          picture: avatarUrl,
        },
      };
      openLightbox([imageItem], 0);
    }
  };

  const handleVideoClick = (e) => {
    e.stopPropagation();
    if (postVideoUrl) {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      const videoItem = {
        src: postVideoUrl,
        type: 'video',
        meta: {
          postId: id,
          caption: text || '',
          name: displayName,
          userId: post.user?.id || post.authorId || post.userId,
          picture: avatarUrl,
          poster: postImageUrl || undefined,
        },
      };
      openLightbox([videoItem], 0);
    }
  };

  const handleVideoDblClick = (e) => {
    e.stopPropagation();
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
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
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
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
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

  // ── Render mention badge ──
  const renderMentionBadge = () => {
    if (!isUserMentioned && !isMentioned) return null;
    return (
      <span className="inline-flex items-center gap-1 ml-2 text-xs bg-[var(--color-accent-bg)] text-[var(--color-accent)] px-2 py-0.5 rounded-full">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        Mentioned you
      </span>
    );
  };

  const renderMedia = () => {
    if (postVideoUrl) {
      return (
        <div
          ref={videoContainerRef}
          className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border)] bg-black/5 relative cursor-pointer"
          onClick={handleVideoClick}
          onDoubleClick={handleVideoDblClick}
        >
          {videoError ? (
            <div className="p-6 text-center text-[var(--color-txt2)] text-sm">
              <svg
                className="w-10 h-10 mx-auto mb-2 text-[var(--color-txt3)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Video failed to load</p>
              <a
                href={postVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline text-xs"
              >
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
                className="w-full h-auto object-contain max-h-96 sm:max-h-[500px]"
                poster={postImageUrl || undefined}
                onError={handleVideoError}
                preload="metadata"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
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
            className="w-full h-auto object-cover max-h-96 sm:max-h-[500px] cursor-pointer hover:opacity-90 transition"
            onClick={handleImageClick}
          />
        </div>
      );
    }

    return null;
  };

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
              <div className="text-xs text-[var(--color-txt3)] mt-2">{siteName}</div>
            )}
          </div>
        </div>
      </a>
    );
  };

  const isAuthor =
    currentUser && (post.user?.id === currentUser.id || post.authorId === currentUser.id);

  const userId = post.user?.id || post.authorId || post.userId;
  const usernameForProfile = post.user?.username || post.authorUsername || post.username;
  const profileUrl = usernameForProfile
    ? `/profile/${usernameForProfile}`
    : userId
    ? `/profile?userId=${userId}`
    : null;

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

  const renderViewCounts = () => {
    const regularBadge = (
      <span className="flex items-center gap-1" title="Total page views">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {formatNumber(regularViewsState)}
      </span>
    );

    const videoBadge = postVideoUrl ? (
      <span className="flex items-center gap-1" title="Video views">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polygon points="5,3 19,12 5,21" />
        </svg>
        {formatNumber(videoViewsState)}
      </span>
    ) : null;

    return (
      <div className="flex items-center gap-2 text-[var(--color-txt3)] text-xs flex-shrink-0">
        {regularBadge}
        {videoBadge}
      </div>
    );
  };

  const renderReasonButton = () => {
    if (!reasons || reasons.length === 0) return null;
    return (
      <div className="relative" ref={reasonRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowReasons(!showReasons);
          }}
          className="p-1 text-[var(--color-txt3)] hover:text-[var(--color-accent)] rounded-full hover:bg-[var(--color-accent-bg)] transition"
          title="Why this post?"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
        {showReasons && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg p-3 min-w-[200px] max-w-[280px]">
            <div className="text-xs text-[var(--color-txt2)] font-medium mb-1">
              Why you're seeing this
            </div>
            <ul className="text-xs text-[var(--color-txt)] space-y-1 list-disc list-inside">
              {reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderOriginalPost = () => {
    if (!originalPost) return null;
    const origAuthor = originalPost.author || 'Unknown';
    const origUsername = originalPost.username || '';
    const origAvatar = originalPost.authorPicture || '';
    const origText = originalPost.text || '';
    const origImage = originalPost.image || '';
    const origVideo = originalPost.video || '';
    const origCreated = originalPost.createdAt || new Date().toISOString();

    const origAvatarUrl = resolveMediaUrl(origAvatar);
    const origRelativeTime = timeAgo(origCreated);
    const origImageUrl = resolveMediaUrl(origImage);
    const origVideoUrl = resolveMediaUrl(origVideo);

    return (
      <div
        className="mt-2 pl-3 bg-[var(--color-surface)] rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3">
          <div className="flex items-center gap-2">
            {origAvatarUrl ? (
              <img src={origAvatarUrl} alt={origAuthor} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <AvatarPlaceholder size="h-6 w-6" />
            )}
            <span className="font-semibold text-xs text-[var(--color-txt)]">{origAuthor}</span>
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
            <div className="mt-2 rounded-lg overflow-hidden border border-[var(--color-border)]">
              {origVideoUrl ? (
                <video
                  src={origVideoUrl}
                  controls
                  playsInline
                  className="w-full h-auto object-contain max-h-96 sm:max-h-[500px]"
                />
              ) : (
                <img
                  src={origImageUrl}
                  alt="Original post image"
                  className="w-full h-auto object-cover max-h-96 sm:max-h-[500px]"
                />
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

  const renderAvatar = (size = 'h-10 w-10', className = '') => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName}
          className={`${size} rounded-full object-cover ${className}`}
        />
      );
    }
    return <AvatarPlaceholder size={size} className={className} />;
  };

  const renderFollowButton = () => {
    if (!showFollowButton || !onFollowToggle) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFollowToggle();
        }}
        className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full transition md:hidden ${
          isFollowing
            ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]'
            : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    );
  };

  const renderRepostedIndicator = () => {
    if (!isRepost) return null;
    return (
      <span className="text-xs text-[var(--color-txt3)] flex items-center gap-1 ml-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
        Reposted
      </span>
    );
  };

  // ── Get card style with mention highlight ──
  const getCardStyle = () => {
    if (isUserMentioned || isMentioned) {
      return `${cardClasses} bg-[var(--color-accent-bg)] border-l-4 border-[var(--color-accent)]`;
    }
    return cardClasses;
  };

  // ── Repost layout ──
  if (isRepost && originalPost) {
    return (
      <div className={getCardStyle()}>
        <div className="flex items-start gap-3">
          {profileUrl ? (
            <Link href={profileUrl} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {renderAvatar('h-10 w-10')}
            </Link>
          ) : (
            renderAvatar('h-10 w-10')
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    title="View profile"
                  >
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm inline-flex items-center gap-1">
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </span>
                )}
                {renderRepostedIndicator()}
                {renderMentionBadge()}
                {renderFollowButton()}
                {username &&
                  (profileUrl ? (
                    <Link
                      href={profileUrl}
                      className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  ))}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {renderViewCounts()}
                {renderReasonButton()}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
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
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                        </svg>
                        {imageLoading ? 'Generating…' : 'Download as Image'}
                      </button>
                      <button
                        onClick={handleSharePostImage}
                        disabled={imageLoading}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
            </div>

            {text && (
              <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
              </div>
            )}

            {renderOriginalPost()}

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--color-txt2)] text-xs">
              <LikeButton count={likeCount} active={isLiked} onToggle={handleLike} />
              <CommentButton
                count={commentCount ?? comments.length}
                onClick={() => onComment && onComment(id)}
              />
              <RepostButton
                count={repostCountState}
                active={isReposted}
                onClick={handleRepost}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuote) onQuote(id);
                }}
                className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
                title="Quote this post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
                </svg>
              </button>
              <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
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
        className={`${cardClasses} bg-[var(--color-rose-bg)]`}
        onClick={handleLiveClick}
      >
        <div className="flex items-start gap-3">
          {profileUrl ? (
            <Link href={profileUrl} onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
              {renderAvatar('h-10 w-10')}
            </Link>
          ) : (
            renderAvatar('h-10 w-10')
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition inline-flex items-center gap-1"
                  >
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm inline-flex items-center gap-1">
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </span>
                )}
                {renderMentionBadge()}
                {renderFollowButton()}
                {username &&
                  (profileUrl ? (
                    <Link
                      href={profileUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition"
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  ))}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {renderViewCounts()}
                {renderReasonButton()}
                <span className="flex items-center gap-1 bg-[var(--color-rose)] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
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
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                        </svg>
                        {imageLoading ? 'Generating…' : 'Download as Image'}
                      </button>
                      <button
                        onClick={handleSharePostImage}
                        disabled={imageLoading}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
            </div>
            <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
              <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 bg-black/10 dark:bg-white/10 rounded-lg p-3">
              <svg
                className="w-8 h-8 text-[var(--color-rose)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="10,8 16,12 10,16" fill="currentColor" />
              </svg>
              <span className="text-sm font-semibold text-[var(--color-rose)]">Tap to watch live</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-[var(--color-txt2)] text-xs">
              <LikeButton count={likeCount} active={isLiked} onToggle={handleLike} />
              <CommentButton
                count={commentCount ?? comments.length}
                onClick={() => onComment && onComment(id)}
              />
              <RepostButton
                count={repostCountState}
                active={isReposted}
                onClick={handleRepost}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQuote) onQuote(id);
                }}
                className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
                title="Quote this post"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
                </svg>
              </button>
              <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Regular post layout ──
  return (
    <div className={getCardStyle()}>
      <div className="flex items-start gap-3">
        {profileUrl ? (
          <Link href={profileUrl} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {renderAvatar('h-10 w-10')}
          </Link>
        ) : (
          renderAvatar('h-10 w-10')
        )}

        <div className="flex-1 min-w-0">
          <div className="block cursor-pointer" onClick={goToPost}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="font-semibold text-[var(--color-txt)] text-sm hover:underline hover:text-[var(--color-accent)] transition inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    title="View profile"
                  >
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </Link>
                ) : (
                  <span className="font-semibold text-[var(--color-txt)] text-sm inline-flex items-center gap-1">
                    {displayName}
                    {isVerified && <VerificationBadge size="w-4 h-4" />}
                  </span>
                )}
                {renderMentionBadge()}
                {renderFollowButton()}
                {username &&
                  (profileUrl ? (
                    <Link
                      href={profileUrl}
                      className="text-[var(--color-txt2)] text-xs hover:underline hover:text-[var(--color-accent)] transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{username}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-txt2)] text-xs">@{username}</span>
                  ))}
                <span className="text-[var(--color-txt3)] text-xs">· {relativeTime}</span>
                {renderGroupBadge()}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {renderViewCounts()}
                {renderReasonButton()}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
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
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                        </svg>
                        {imageLoading ? 'Generating…' : 'Download as Image'}
                      </button>
                      <button
                        onClick={handleSharePostImage}
                        disabled={imageLoading}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition disabled:opacity-50"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
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
            </div>

            <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
              {shouldTruncate ? (
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text.slice(0, 200) + '…') }} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: formatPostText(text) }} />
              )}
              {text?.length > 200 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleExpand();
                  }}
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
            <CommentButton
              count={commentCount ?? comments.length}
              onClick={() => onComment && onComment(id)}
            />
            <RepostButton
              count={repostCountState}
              active={isReposted}
              onClick={handleRepost}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onQuote) onQuote(id);
              }}
              className="flex items-center gap-1 transition hover:text-[var(--color-accent)] text-[var(--color-txt2)]"
              title="Quote this post"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10 11H6a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L8 18.5M20 11h-4a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v4c0 2.5-1 4-2.5 5.5L18 18.5" />
              </svg>
            </button>
            <ShareButton count={shares || 0} onClick={() => onShare && onShare(id)} />
          </div>
        </div>
      </div>
    </div>
  );
}