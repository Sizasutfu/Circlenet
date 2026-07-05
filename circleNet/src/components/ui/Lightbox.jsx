// src/components/ui/Lightbox.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

// ── Helpers ──
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

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Main Component ──
export default function Lightbox({ images, initialIndex = 0, onClose }) {
  const { user } = useAuth();
  const router = useRouter();

  // ── Normalize images ──
  const normalized = images.map((img) => {
    if (typeof img === 'string') {
      return { src: img, type: 'image', meta: {} };
    }
    return img;
  });

  const [items] = useState(normalized);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  const [replyToAuthor, setReplyToAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [reportReason, setReportReason] = useState(null);
  const [reportOther, setReportOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [postData, setPostData] = useState(null);
  const [postLoading, setPostLoading] = useState(true);

  // Refs for gesture handling
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const startTranslateX = useRef(0);
  const startTranslateY = useRef(0);
  const pointers = useRef(new Map());
  const pinchStartDist = useRef(0);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isSwiping = useRef(false);
  const navAxis = useRef(localStorage.getItem('circle_lb_nav_axis') || 'lr');

  // ── Fetch post data for comments/likes ──
  const currentItem = items[currentIndex];
  const postId = currentItem?.meta?.postId || null;

  useEffect(() => {
    if (postId) {
      const fetchPost = async () => {
        try {
          const res = await apiClient(`/api/posts/${postId}`);
          setPostData(res.data || res);
        } catch (_) {
          setPostData(null);
        } finally {
          setPostLoading(false);
        }
      };
      fetchPost();
    } else {
      setPostData(null);
      setPostLoading(false);
    }
  }, [postId]);

  // ── Render profile chip ──
  const renderProfile = () => {
    const meta = currentItem?.meta || {};
    if (!meta.name) return null;
    return (
      <div
        className="flex items-center gap-2 bg-black/55 backdrop-blur-md px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/70 transition"
        onClick={() => {
          if (meta.userId) {
            onClose();
            setTimeout(() => router.push(`/profile/${meta.userId}`), 200);
          }
        }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0"
          style={{
            background: meta.picture ? 'transparent' : stringToColor(meta.name),
          }}
        >
          {meta.picture ? (
            <img src={meta.picture} alt="" className="w-full h-full object-cover" />
          ) : (
            meta.name.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div className="text-white text-sm font-bold leading-tight">{meta.name}</div>
          <div className="text-white/50 text-[10px] leading-tight">View profile</div>
        </div>
      </div>
    );
  };

  // ── Render caption ──
  const renderCaption = () => {
    const cap = currentItem?.meta?.caption || '';
    if (!cap) return null;
    return <div className="text-white text-sm text-center max-w-[80%] mx-auto mt-2">{cap}</div>;
  };

  // ── Navigation ──
  const goTo = useCallback((newIdx) => {
    if (isAnimating || newIdx < 0 || newIdx >= items.length) return;
    setIsAnimating(true);
    setCurrentIndex(newIdx);
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setPostData(null);
    setPostLoading(true);
    setShowComments(false);
    setShowReport(false);
    setReplyToId(null);
    setReplyToAuthor('');
    setTimeout(() => setIsAnimating(false), 300);
  }, [items.length, isAnimating]);

  const goPrev = () => goTo(currentIndex - 1);
  const goNext = () => goTo(currentIndex + 1);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && !showComments && !showReport) goPrev();
      if (e.key === 'ArrowRight' && !showComments && !showReport) goNext();
      if (e.key === 'ArrowUp' && navAxis.current === 'ud') goPrev();
      if (e.key === 'ArrowDown' && navAxis.current === 'ud') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, showComments, showReport, onClose]);

  // ── Actions ──
  const handleLike = async () => {
    if (!user) {
      alert('Log in to like.');
      return;
    }
    if (!postId) return;
    try {
      await apiClient(`/api/posts/${postId}/like`, { method: 'POST' });
      // Refresh post data
      const res = await apiClient(`/api/posts/${postId}`);
      setPostData(res.data || res);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleRepost = async () => {
    if (!user) {
      alert('Log in to repost.');
      return;
    }
    if (!postId) return;
    try {
      await apiClient(`/api/posts/${postId}/repost`, { method: 'POST' });
      const res = await apiClient(`/api/posts/${postId}`);
      setPostData(res.data || res);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleCommentSubmit = async () => {
    if (!user) {
      alert('Log in to comment.');
      return;
    }
    const text = commentText.trim();
    if (!text || !postId) return;
    setCommentLoading(true);
    try {
      const payload = { text };
      if (replyToId) payload.parentId = replyToId;
      await apiClient(`/api/posts/${postId}/comment`, { method: 'POST', body: JSON.stringify(payload) });
      setCommentText('');
      setReplyToId(null);
      setReplyToAuthor('');
      // Refresh post
      const res = await apiClient(`/api/posts/${postId}`);
      setPostData(res.data || res);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!user) {
      alert('Log in to report.');
      return;
    }
    let reason = reportReason;
    if (reason === 'Other') {
      const other = reportOther.trim();
      if (!other || other.length < 5) {
        alert('Please describe the issue (min 5 chars).');
        return;
      }
      reason = other;
    }
    if (!reason) return;
    setSubmitting(true);
    try {
      await apiClient('/api/admin/reports', {
        method: 'POST',
        body: JSON.stringify({ postId, reason }),
      });
      setShowReport(false);
      alert('Report submitted. Thank you! ✅');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render comment tree ──
  const renderComments = (comments, depth = 0) => {
    if (!comments || !comments.length) return null;
    return comments.map((c) => {
      const replies = c.replies || [];
      const hasReplies = replies.length > 0;
      const isReply = depth > 0;
      return (
        <div key={c.id} className={`flex gap-2 ${isReply ? 'ml-6 mt-2' : 'mt-3'}`}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0"
            style={{
              background: c.authorPicture ? 'transparent' : stringToColor(c.author || '?'),
            }}
          >
            {c.authorPicture ? (
              <img src={c.authorPicture} alt="" className="w-full h-full object-cover" />
            ) : (
              (c.author || '?').charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-bold">{c.author || 'Anonymous'}</span>
              <span className="text-white/40 text-xs">{formatTime(c.createdAt)}</span>
            </div>
            <div className="text-white/90 text-sm">{c.text}</div>
            <button
              className="text-white/40 text-xs hover:text-white/70 transition mt-1"
              onClick={() => {
                setReplyToId(c.id);
                setReplyToAuthor(c.author || 'Anonymous');
              }}
            >
              Reply
            </button>
            {hasReplies && (
              <details className="mt-1">
                <summary className="text-white/40 text-xs hover:text-white/70 cursor-pointer">
                  View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </summary>
                {renderComments(replies, depth + 1)}
              </details>
            )}
          </div>
        </div>
      );
    });
  };

  // ── Gesture handlers ──
  const onPointerDown = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      swipeStartX.current = e.clientX;
      swipeStartY.current = e.clientY;
      dragStartX.current = e.clientX - translateX;
      dragStartY.current = e.clientY - translateY;
      isSwiping.current = scale <= 1 || currentItem.type === 'video';
    } else if (pointers.current.size === 2) {
      isSwiping.current = false;
      const pts = [...pointers.current.values()];
      pinchStartDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
  };

  const onPointerMove = (e) => {
    if (currentItem.type === 'video') return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const newScale = Math.min(5, Math.max(1, scale * (dist / pinchStartDist.current)));
      pinchStartDist.current = dist;
      setScale(newScale);
      if (imgRef.current) {
        imgRef.current.style.transition = 'none';
        imgRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${newScale})`;
      }
    } else if (pointers.current.size === 1 && scale > 1) {
      const newX = e.clientX - dragStartX.current;
      const newY = e.clientY - dragStartY.current;
      setTranslateX(newX);
      setTranslateY(newY);
      if (imgRef.current) {
        imgRef.current.style.transition = 'none';
        imgRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${scale})`;
      }
    }
  };

  const onPointerUp = (e) => {
    const startX = swipeStartX.current;
    const startY = swipeStartY.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && isSwiping.current) {
      if (scale <= 1 || currentItem.type === 'video') {
        const axis = navAxis.current;
        if (axis === 'ud') {
          const dy = e.clientY - startY;
          if (Math.abs(dy) > 55) goTo(currentIndex + (dy < 0 ? 1 : -1));
        } else {
          const dx = e.clientX - startX;
          if (Math.abs(dx) > 55) goTo(currentIndex + (dx < 0 ? 1 : -1));
        }
      }
      isSwiping.current = false;
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const axis = navAxis.current;
    const navDelta = axis === 'ud' ? e.deltaY : e.deltaX;
    const zoomDelta = axis === 'ud' ? e.deltaX : e.deltaY;

    if (Math.abs(navDelta) > Math.abs(zoomDelta) || axis === 'ud') {
      if (!onWheel._lastNavTime || Date.now() - onWheel._lastNavTime > 200) {
        goTo(currentIndex + (navDelta > 0 ? 1 : -1));
        onWheel._lastNavTime = Date.now();
      }
      return;
    }

    if (currentItem.type === 'video') return;
    const newScale = Math.min(5, Math.max(1, scale * (zoomDelta < 0 ? 1.12 : 0.9)));
    if (newScale <= 1) {
      setTranslateX(0);
      setTranslateY(0);
    }
    setScale(newScale);
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.12s ease';
      imgRef.current.style.transform = `translate(${translateX}px, ${translateY}px) scale(${newScale})`;
    }
  };
  onWheel._lastNavTime = 0;

  const onDblClick = () => {
    if (currentItem.type === 'video') return;
    const newScale = scale > 1 ? 1 : 2.2;
    setScale(newScale);
    setTranslateX(0);
    setTranslateY(0);
    if (imgRef.current) {
      imgRef.current.style.transition = 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1)';
      imgRef.current.style.transform = newScale > 1 ? `scale(${newScale})` : 'none';
    }
  };

  // ── Render portal ──
  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      style={{ display: 'flex' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDoubleClick={onDblClick}
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/60 hover:text-white transition z-20 p-2"
        title='Close'
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Profile chip */}
      <div className="absolute top-4 left-4 z-20">
        {renderProfile()}
      </div>

      {/* Main media */}
      <div className="relative w-full h-full flex items-center justify-center">
        {currentItem.type === 'video' ? (
          <video
            key={currentItem.src}
            src={currentItem.src}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            ref={imgRef}
            src={currentItem.src}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
            style={{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            }}
          />
        )}
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-2 bg-black/30 rounded-full"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          {currentIndex < items.length - 1 && (
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-2 bg-black/30 rounded-full"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </>
      )}

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-sm bg-black/40 px-3 py-1 rounded-full">
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Caption */}
      {renderCaption() && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 text-white text-sm max-w-[80%] text-center">
          {renderCaption()}
        </div>
      )}

      {/* Action buttons (like, comment, repost, share, download, report) */}
      {postData && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-20 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-white/80 hover:text-white transition ${postData.likes?.includes(user?.id) ? 'text-rose-500' : ''}`}
            title="Like"
          >
            <svg className="w-5 h-5" fill={postData.likes?.includes(user?.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
            <span className="text-xs">{postData.likes?.length || 0}</span>
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-white/80 hover:text-white transition"
            title="Comments"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <span className="text-xs">{postData.comments?.length || 0}</span>
          </button>
          <button
            onClick={handleRepost}
            className="flex items-center gap-1 text-white/80 hover:text-white transition"
            title="Repost"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 1l4 4-4 4" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <path d="M7 23l-4-4 4-4" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            <span className="text-xs">{postData.reposts?.length || 0}</span>
          </button>
          <button
            onClick={() => {
              const url = window.location.origin + `/post/${postId}`;
              if (navigator.share) navigator.share({ url });
              else navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
            }}
            className="text-white/80 hover:text-white transition"
            title="Share"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = currentItem.src;
              a.download = currentItem.type === 'video' ? 'video.mp4' : 'image.jpg';
              a.target = '_blank';
              a.click();
            }}
            className="text-white/80 hover:text-white transition"
            title="Download"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            onClick={() => setShowReport(!showReport)}
            className="text-white/80 hover:text-white transition"
            title="Report"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        </div>
      )}

      {/* Comments panel */}
      {showComments && postData && (
        <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-black/90 backdrop-blur-md border-l border-white/10 p-4 flex flex-col z-30 animate-slideInRight">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-lg">Comments</h3>
            <button onClick={() => setShowComments(false)} className="text-white/60 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {postData.comments && postData.comments.length > 0 ? (
              renderComments(postData.comments)
            ) : (
              <div className="text-white/40 text-center py-8">No comments yet.</div>
            )}
          </div>
          {replyToId && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-white/60 text-sm">Replying to <span className="text-white font-semibold">{replyToAuthor}</span></span>
              <button onClick={() => { setReplyToId(null); setReplyToAuthor(''); }} className="text-white/40 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyToId ? `Reply to ${replyToAuthor}…` : "Add a comment…"}
              className="flex-1 bg-white/10 rounded-full px-4 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-white/30"
              disabled={commentLoading}
              onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit()}
            />
            <button
              onClick={handleCommentSubmit}
              disabled={commentLoading || !commentText.trim()}
              className="bg-white/20 text-white px-4 py-2 rounded-full text-sm hover:bg-white/30 transition disabled:opacity-50"
            >
              {commentLoading ? '…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Report panel */}
      {showReport && postData && (
        <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-black/90 backdrop-blur-md border-l border-white/10 p-4 flex flex-col z-30 animate-slideInRight">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-lg">Report</h3>
            <button onClick={() => setShowReport(false)} className="text-white/60 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            {['Spam', 'Harassment', 'Inappropriate content', 'Other'].map((reason) => (
              <button
                key={reason}
                onClick={() => setReportReason(reason === 'Other' ? 'Other' : reason)}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm transition ${
                  reportReason === reason
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {reason}
              </button>
            ))}
            {reportReason === 'Other' && (
              <textarea
                value={reportOther}
                onChange={(e) => setReportOther(e.target.value)}
                placeholder="Describe the issue (min 5 chars)"
                className="w-full bg-white/10 rounded-lg px-4 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-white/30 resize-none h-20"
              />
            )}
          </div>
          <button
            onClick={handleReportSubmit}
            disabled={submitting || !reportReason || (reportReason === 'Other' && reportOther.length < 5)}
            className="mt-4 bg-rose-500 text-white py-2 rounded-lg hover:bg-rose-600 transition disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}