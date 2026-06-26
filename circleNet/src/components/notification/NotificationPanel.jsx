// src/components/notification/NotificationPanel.jsx
'use client';

import { useEffect, useRef } from 'react';
import { useNotifications, NOTIF_ICONS, escHtml } from '@/contexts/NotificationContext';
import { useAuth } from '@/lib/auth';

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

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

const NOTIF_COPY = {
  like: (name) => `<strong>${escHtml(name)}</strong> liked your post`,
  comment: (name) => `<strong>${escHtml(name)}</strong> commented on your post`,
  reply: (name) => `<strong>${escHtml(name)}</strong> replied to your comment`,
  repost: (name) => `<strong>${escHtml(name)}</strong> echoed your post`,
  follow: (name) => `<strong>${escHtml(name)}</strong> started following you`,
  new_post: (name) => `<strong>${escHtml(name)}</strong> published a new post`,
  live: (name) => `<strong>${escHtml(name)}</strong> just started a live stream`,
  profile_pic: (name) => `<strong>${escHtml(name)}</strong> updated their profile picture`,
  mention: (name) => `<strong>${escHtml(name)}</strong> mentioned you in a post`,
  milestone: (name) => `🎉 <strong>${escHtml(name)}</strong>`,
  report_resolved: () => `<strong>Report resolved</strong>`,
  report_ignored: () => `<strong>Report reviewed</strong>`,
};

function NotificationItem({ notification, onClick }) {
  const { id, type, actorName, actorPicture, message, postSnippet, createdAt, isRead, actorId, sessionId, postId } = notification;
  const isSystem = !actorId;
  const color = stringToColor(actorName || '?');
  const initial = (actorName || '?').charAt(0).toUpperCase();

  const avatarHtml = isSystem ? (
    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
      🛡️
    </div>
  ) : (
    <div
      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
      style={{ background: actorPicture ? 'transparent' : color }}
    >
      {actorPicture ? (
        <img src={actorPicture} alt={initial} className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );

  const notifText = message ? escHtml(message) : (NOTIF_COPY[type] || NOTIF_COPY.like)(actorName || 'Someone');
  const iconSvg = NOTIF_ICONS[type] || '';
  const picThumb = type === 'profile_pic' && actorPicture ? (
    <img src={actorPicture} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-[var(--color-accent)] flex-shrink-0" />
  ) : null;

  return (
    <div
      className={`flex items-start gap-3 p-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition ${!isRead ? 'bg-[var(--color-accent-bg)]/20' : ''}`}
      onClick={() => onClick(notification)}
    >
      {avatarHtml}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-txt)]" dangerouslySetInnerHTML={{ __html: notifText }} />
        {postSnippet && (
          <div className="text-xs text-[var(--color-txt2)] mt-1 truncate">"{escHtml(postSnippet)}"</div>
        )}
        <div className="text-xs text-[var(--color-txt3)] mt-1">{formatTime(createdAt)}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {picThumb || (
          <div className="w-6 h-6 text-[var(--color-txt3)]" dangerouslySetInnerHTML={{ __html: iconSvg }} />
        )}
        {!isRead && <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0" />}
      </div>
    </div>
  );
}

export default function NotificationPanel() {
  const { notifications, loading, hasMore, fetchNotifications, isPanelOpen, closePanel, onNotifClick } = useNotifications();
  const { user } = useAuth();
  const listRef = useRef(null);

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

  if (!user) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${isPanelOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closePanel}
        style={{ background: 'rgba(0,0,0,0.5)' }}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[var(--color-card)] shadow-xl transition-transform duration-300 ease-out ${isPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <h2 className="text-lg font-head font-extrabold text-[var(--color-txt)]">Notifications</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { /* mark all read handled on close */ }}
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
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-txt2)]">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
              <p className="mt-4">Loading…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-txt2)]">
              <svg className="w-12 h-12 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <>
              {notifications.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onClick={onNotifClick}
                />
              ))}
              {loading && (
                <div className="p-4 text-center text-[var(--color-txt2)]">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
                </div>
              )}
              {!hasMore && notifications.length > 0 && (
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