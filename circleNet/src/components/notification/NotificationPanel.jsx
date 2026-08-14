// src/components/notification/NotificationPanel.jsx
'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAuth } from '@/lib/auth';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import { resolveMediaUrl } from '@/lib/url';

// ── Constants (icons, helpers) ──
const NOTIF_ICONS = {
  like: `<svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`,
  comment: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  reply: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>`,
  repost: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  follow: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>`,
  new_post: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/></svg>`,
  live: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><path d="M6.3 6.3a8 8 0 000 11.4"/><path d="M17.7 6.3a8 8 0 010 11.4"/><path d="M3.5 3.5a13.5 13.5 0 000 17"/><path d="M20.5 3.5a13.5 13.5 0 010 17"/></svg>`,
  profile_pic: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  mention: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>`,
  milestone: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  report_resolved: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`,
  report_ignored: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  verified: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  unverified: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
};

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

// ── Notification copy for each type ──
const NOTIF_COPY = {
  like: (name) => `<strong>${escHtml(name)}</strong> liked your post`,
  comment: (name) => `<strong>${escHtml(name)}</strong> commented on your post`,
  reply: (name) => `<strong>${escHtml(name)}</strong> replied to your comment`,
  repost: (name) => `<strong>${escHtml(name)}</strong> echoed your post`,
  follow: (name) => `<strong>${escHtml(name)}</strong> started following you`,
  new_post: (name) => `<strong>${escHtml(name)}</strong> published a new post`,
  live: (name) => `<strong>${escHtml(name)}</strong> just started a live stream`,
  profile_pic: (name) => `<strong>${escHtml(name)}</strong> updated their profile picture`,
  mention: (name, context) => {
    if (context === 'reply') {
      return `<strong>${escHtml(name)}</strong> mentioned you in a comment`;
    }
    return `<strong>${escHtml(name)}</strong> mentioned you in a post`;
  },
  milestone: (name) => `🎉 <strong>${escHtml(name)}</strong>`,
  report_resolved: () => `<strong>Report resolved</strong>`,
  report_ignored: () => `<strong>Report reviewed</strong>`,
  verified: () => `<strong>✅ Your account has been verified!</strong> You now have a verification badge.`,
  unverified: () => `<strong>❌ Your verification badge has been removed.</strong>`,
};

// ── Get notification text ──
function getNotifText(notification) {
  const { type, actorName, message, customMessage } = notification;
  
  if (customMessage) return escHtml(customMessage);
  if (message) return escHtml(message);
  
  const copyFn = NOTIF_COPY[type];
  if (!copyFn) return `<strong>${escHtml(actorName || 'Someone')}</strong> interacted with you`;
  
  if (type === 'mention') {
    const context = notification.mentionType || 'post';
    return copyFn(actorName || 'Someone', context);
  }
  
  if (type === 'verified' || type === 'unverified') {
    return copyFn();
  }
  
  return copyFn(actorName || 'Someone');
}

// ── Get notification icon color ──
function getNotifColor(type) {
  const colors = {
    like: 'text-rose-500',
    comment: 'text-blue-500',
    reply: 'text-blue-500',
    repost: 'text-green-500',
    follow: 'text-cyan-500',
    new_post: 'text-purple-500',
    live: 'text-rose-500',
    profile_pic: 'text-amber-500',
    mention: 'text-indigo-500',
    milestone: 'text-yellow-500',
    report_resolved: 'text-green-500',
    report_ignored: 'text-gray-500',
    verified: 'text-green-500',
    unverified: 'text-rose-500',
  };
  return colors[type] || 'text-[var(--color-txt2)]';
}

function NotificationItem({ notification, onClick }) {
  const { 
    id, 
    type, 
    actorName, 
    actorPicture, 
    actorUsername,
    message, 
    postSnippet, 
    createdAt, 
    isRead, 
    actorId, 
    sessionId, 
    postId,
    customMessage 
  } = notification;
  
  const isSystem = !actorId;
  const initial = (actorName || '?').charAt(0).toUpperCase();
  const avatarUrl = resolveMediaUrl(actorPicture);
  const isVerification = type === 'verified' || type === 'unverified';
  const isMention = type === 'mention';

  const avatarHtml = isSystem ? (
    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
      {isVerification ? '✅' : '🛡️'}
    </div>
  ) : avatarUrl ? (
    <img
      src={avatarUrl}
      alt={actorName || 'User'}
      className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
    />
  ) : (
    <AvatarPlaceholder size="w-10 h-10" name={actorName} />
  );

  const notifText = getNotifText(notification);
  const iconSvg = NOTIF_ICONS[type] || '';
  const iconColor = getNotifColor(type);
  
  const mentionBadge = isMention ? (
    <span className="ml-1 text-[10px] bg-[var(--color-accent-bg)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-full">
      @
    </span>
  ) : null;

  const verificationBadge = isVerification ? (
    <span className="ml-1 text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full">
      {type === 'verified' ? '✓' : '✗'}
    </span>
  ) : null;

  const picThumb = type === 'profile_pic' && avatarUrl ? (
    <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-[var(--color-accent)] flex-shrink-0" />
  ) : null;

  const isVerificationUnread = isVerification && !isRead;
  const cardBorder = isVerificationUnread ? 'border-l-4 border-l-green-500' : '';
  const cardBg = isVerificationUnread ? 'bg-green-500/5' : '';

  return (
    <div
      className={`flex items-start gap-3 p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition ${
        !isRead ? 'bg-[var(--color-accent-bg)]/20' : ''
      } ${cardBg} ${cardBorder} ${
        isMention && !isRead ? 'border-l-4 border-l-[var(--color-accent)]' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      {avatarHtml}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-txt)]">
          <span dangerouslySetInnerHTML={{ __html: notifText }} />
          {mentionBadge}
          {verificationBadge}
        </div>
        {postSnippet && (
          <div className="text-xs text-[var(--color-txt2)] mt-1 truncate">
            "{escHtml(postSnippet)}"
          </div>
        )}
        {actorUsername && !isSystem && (
          <div className="text-xs text-[var(--color-txt3)] mt-0.5">
            @{escHtml(actorUsername)}
          </div>
        )}
        <div className="text-xs text-[var(--color-txt3)] mt-1">
          {formatTime(createdAt)}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {picThumb || (
          <div className={`w-6 h-6 ${iconColor}`} dangerouslySetInnerHTML={{ __html: iconSvg }} />
        )}
        {!isRead && <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0" />}
      </div>
    </div>
  );
}

export default function NotificationPanel() {
  const { 
    notifications, 
    loading, 
    hasMore, 
    fetchNotifications, 
    isPanelOpen, 
    closePanel, 
    markAsRead,
    markAllRead 
  } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const listRef = useRef(null);

  // ── Deduplicate notifications by ID ──
  const uniqueNotifications = useMemo(() => {
    const seen = new Set();
    return notifications.filter(notif => {
      const key = notif.id;
      if (seen.has(key)) {
        console.warn(`Duplicate notification ID found: ${key}`);
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [notifications]);

  useEffect(() => {
    if (isPanelOpen && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [isPanelOpen]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100 && !loading && hasMore) {
      fetchNotifications(false);
    }
  };

  // ── Handle notification click with navigation ──
  const handleNotificationClick = async (notif) => {
    await markAsRead(notif.id);
    closePanel();

    if (notif.type === 'verified' || notif.type === 'unverified') {
      return;
    }

    if (notif.postId) {
      router.push(`/post/${notif.postId}`);
    } else if (notif.sessionId) {
      router.push(`/live/${notif.sessionId}`);
    } else if (notif.actorId) {
      if (notif.type === 'follow' || notif.type === 'profile_pic') {
        router.push(`/profile/${notif.actorUsername || notif.actorId}`);
      } else {
        router.push(`/profile?userId=${notif.actorId}`);
      }
    }
  };

  // ── Handle "Mark all read" ──
  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  if (!user) return null;

  const unreadVerifications = uniqueNotifications.filter(
    n => (n.type === 'verified' || n.type === 'unverified') && !n.isRead
  ).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closePanel}
        style={{ background: 'rgba(0,0,0,0.5)' }}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[var(--color-card)] shadow-xl transition-transform duration-300 ease-out ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-head font-extrabold text-[var(--color-txt)]">
              Notifications
            </h2>
            {uniqueNotifications.filter(n => n.type === 'mention' && !n.isRead).length > 0 && (
              <span className="text-xs bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full">
                {uniqueNotifications.filter(n => n.type === 'mention' && !n.isRead).length} mentions
              </span>
            )}
            {unreadVerifications > 0 && (
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                {unreadVerifications} {unreadVerifications === 1 ? 'update' : 'updates'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
            >
              Mark all read
            </button>
            <button
              onClick={closePanel}
              className="p-1 text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-[calc(100%-70px)] overflow-y-auto"
        >
          {loading && uniqueNotifications.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-txt2)]">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
              <p className="mt-4">Loading…</p>
            </div>
          ) : uniqueNotifications.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-txt2)]">
              <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <>
              {uniqueNotifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onClick={handleNotificationClick}
                />
              ))}
              {loading && (
                <div className="p-4 text-center text-[var(--color-txt2)]">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
                </div>
              )}
              {!hasMore && uniqueNotifications.length > 0 && (
                <div className="p-4 text-center text-xs text-[var(--color-txt3)]">
                  You're all caught up ✓
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}