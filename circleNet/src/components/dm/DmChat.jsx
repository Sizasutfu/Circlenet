// src/components/dm/DmChat.jsx
'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useDm } from '@/contexts/DmContext';
import { useDmCall } from '@/contexts/DmCallContext';
import { useAuth } from '@/lib/auth';
import DmVideoCall from './DmVideoCall';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import VerificationBadge from '@/components/ui/VerificationBadge';

function escHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    if (m === '"') return '&quot;';
    return m;
  });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isWithin24Hours(createdAt) {
  const now = Date.now();
  const msgTime = new Date(createdAt).getTime();
  return (now - msgTime) < 24 * 60 * 60 * 1000;
}

function timeAgo(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DmChat() {
  const { user } = useAuth();
  const {
    activeOther,
    messages,
    hasMore,
    loadingMore,
    sendMessage,
    loadMoreMessages,
    typing,
    emitTyping,
    closeConversation,
    otherOnline,
    otherLastActive,
    editMessage,
    deleteMessage,
  } = useDm();

  const { startCall, callState, endCall } = useDmCall();
  const { isActive: isCallActive } = callState;

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const justLoadedMoreRef = useRef(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editingSaving, setEditingSaving] = useState(false);

  const [menuOpenId, setMenuOpenId] = useState(null);
  const menuRef = useRef(null);

  const avatarUrl = resolveMediaUrl(activeOther?.picture);
  const isVerified = !!activeOther?.verified; // ✅ safe boolean

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (justLoadedMoreRef.current) {
      justLoadedMoreRef.current = false;
      return;
    }
    if (loadingMore) return;
    scrollToBottom();
  }, [messages, loadingMore]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(input);
      setInput('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTyping(false);
    } catch (err) {
      // handle error
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    emitTyping(true);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(false);
    }, 2000);
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    justLoadedMoreRef.current = true;
    loadMoreMessages();
  };

  const startEdit = (msg) => {
    const text = msg._plain !== undefined ? msg._plain : msg.body;
    setEditingId(msg.id);
    setEditText(text);
    setMenuOpenId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditingSaving(false);
  };

  const saveEdit = async (msgId) => {
    if (!editText.trim() || editingSaving) return;
    setEditingSaving(true);
    try {
      await editMessage(msgId, editText);
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Edit failed:', err);
    } finally {
      setEditingSaving(false);
    }
  };

  const confirmDelete = (msgId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;
    deleteMessage(msgId).catch((err) => console.error('Delete failed:', err));
    setMenuOpenId(null);
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartCall = async () => {
    if (!activeOther?.id) return;
    await startCall(activeOther.id, activeOther.name, activeOther.picture);
  };

  let lastSentId = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === user?.id && !String(messages[i].id).startsWith('tmp_')) {
      lastSentId = messages[i].id;
      break;
    }
  }

  let lastDate = '';

  return (
    <>
      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-surface)]">
        <button
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-txt2)] bg-[var(--color-accent-bg)] border-none cursor-pointer"
          onClick={() => closeConversation()}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={activeOther?.name || 'User'}
            className="flex-shrink-0 w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="w-10 h-10" />
        )}

        <div className="flex-1 min-w-0">
          <div className="font-head text-base font-extrabold text-[var(--color-txt)] flex items-center gap-1">
            {activeOther?.name || '...'}
            {isVerified && <VerificationBadge size="w-4 h-4" />}
          </div>
          <div className="text-xs flex items-center gap-1">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                typing
                  ? 'bg-[var(--color-green)] animate-pulse'
                  : otherOnline
                  ? 'bg-[var(--color-green)]'
                  : 'bg-[var(--color-txt3)]'
              }`}
            />
            {typing
              ? 'Typing...'
              : otherOnline
              ? 'Online'
              : otherLastActive
              ? `Last seen ${timeAgo(otherLastActive)}`
              : 'Offline'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartCall}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full text-xs font-semibold hover:bg-[var(--color-accent)] hover:text-white transition"
            title="Start video call"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            Video call
          </button>
          <span className="hidden items-center gap-1 text-[11px] font-bold text-[var(--color-green)] bg-[var(--color-green-bg)] border border-[var(--color-green)] rounded-full px-2 py-0.5 cursor-default">
            🔒 End-to-end encrypted
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5"
        id="dm-messages"
      >
        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="block mx-auto my-3 px-4 py-1.5 bg-[var(--color-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)] rounded-full text-xs font-semibold cursor-pointer hover:bg-[var(--color-accent)] hover:text-white transition"
          >
            {loadingMore ? 'Loading…' : '↑ Load earlier messages'}
          </button>
        )}

        {messages.map((msg) => {
          const mine = msg.sender_id === user?.id;
          const dateStr = fmtDate(msg.created_at);
          let divider = null;
          if (dateStr !== lastDate) {
            lastDate = dateStr;
            divider = (
              <div className="text-center text-[11px] font-bold text-[var(--color-txt3)] uppercase tracking-wide my-2.5">
                {dateStr}
              </div>
            );
          }

          const displayText = msg._plain !== undefined ? msg._plain : msg.body;
          const isE2E = msg.body && msg.body.startsWith('e2e:');
          const isTmp = String(msg.id).startsWith('tmp_');
          const editedLabel = msg.edited_at ? (
            <span className="text-[10px] text-[var(--color-txt3)] ml-1">edited</span>
          ) : null;

          const canModify = mine && !isTmp && isWithin24Hours(msg.created_at);
          const isEditing = editingId === msg.id;

          const seenLabel =
            mine && !isTmp && msg.id === lastSentId && msg.is_read ? (
              <div className="text-[11px] font-medium text-[var(--color-txt3)] text-right mt-1 mr-0.5">Seen</div>
            ) : null;

          const key = `${msg.id}-${msg.created_at}-${msg.sender_id}-${isTmp ? 'tmp' : 'real'}`;
          const showMenu = menuOpenId === msg.id;

          return (
            <Fragment key={key}>
              {divider}
              <div className={`flex ${mine ? 'flex-row-reverse' : ''} items-end gap-2 animate-fadeUp`}>
                {mine && !isTmp && !isEditing && canModify && (
                  <div className="relative" ref={showMenu ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpenId(showMenu ? null : msg.id);
                      }}
                      className="text-[var(--color-txt3)] text-base px-1.5 rounded-full hover:bg-[var(--color-surface)] transition"
                    >
                      ⋯
                    </button>
                    {showMenu && (
                      <div
                        className="absolute bottom-full right-0 mb-1 w-32 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10"
                      >
                        <button
                          className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition flex items-center gap-2"
                          onClick={() => startEdit(msg)}
                        >
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-rose)] hover:bg-[var(--color-surface)] transition flex items-center gap-2"
                          onClick={() => confirmDelete(msg.id)}
                        >
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                    mine
                      ? 'bg-[var(--color-accent)] text-white rounded-br-[5px] shadow-md shadow-[var(--color-accent-glow)]'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-txt)] rounded-bl-[5px]'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
                        autoFocus
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={cancelEdit}
                          className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-border)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(msg.id)}
                          disabled={editingSaving || !editText.trim()}
                          className="text-xs px-2 py-0.5 rounded bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)] disabled:opacity-50"
                        >
                          {editingSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div dangerouslySetInnerHTML={{ __html: escHtml(displayText).replace(/\n/g, '<br>') }} />
                      {editedLabel}
                      <div className={`text-[10px] mt-1 opacity-60 ${mine ? 'text-right' : 'text-left'}`}>
                        {fmtTime(msg.created_at)}
                        {isE2E && ' 🔒'}
                      </div>
                    </>
                  )}
                </div>
                {seenLabel}
              </div>
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Compose ── */}
      <div className="flex items-end gap-2.5 px-4 py-3 border-t border-[var(--color-border)] flex-shrink-0 bg-[var(--color-surface)]">
        <textarea
          ref={inputRef}
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl px-4 py-2.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] resize-none max-h-[120px] overflow-y-auto leading-relaxed focus:border-[var(--color-accent)] outline-none transition"
          placeholder="Type a message…"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ height: 'auto' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="w-11 h-11 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center flex-shrink-0 hover:bg-[var(--color-accent-h)] transition shadow-md shadow-[var(--color-accent-glow)] border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {isCallActive && <DmVideoCall onClose={() => endCall()} />}
    </>
  );
}