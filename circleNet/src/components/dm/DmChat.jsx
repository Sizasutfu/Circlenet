// src/components/dm/DmChat.jsx
'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useDm } from '@/contexts/DmContext';
import { useAuth } from '@/lib/auth';

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

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
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
  } = useDm();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(input);
      setInput('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitTyping(false);
    } catch (err) {
      // toast could be shown
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

  // Determine last sent message id for "Seen" label
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] flex-shrink-0 bg-[var(--color-surface)]">
        <button
          className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-txt2)] bg-[var(--color-accent-bg)] border-none cursor-pointer"
          onClick={() => {
            const inbox = document.getElementById('dm-inbox');
            const chat = document.getElementById('dm-chat');
            if (inbox) inbox.classList.remove('hidden', 'md:block');
            if (chat) chat.classList.remove('flex', 'md:flex');
          }}
        >
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
          style={{
            background: activeOther?.picture ? 'transparent' : stringToColor(activeOther?.name || ''),
            overflow: 'hidden',
          }}
        >
          {activeOther?.picture ? (
            <img src={activeOther.picture} alt={activeOther?.name?.charAt(0)} className="w-full h-full object-cover rounded-full" />
          ) : (
            activeOther?.name?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-head text-base font-extrabold text-[var(--color-txt)]">{activeOther?.name || '...'}</div>
          <div className={`text-xs flex items-center gap-1 ${typing ? 'text-[var(--color-green)]' : 'text-[var(--color-txt2)]'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${typing ? 'bg-[var(--color-green)]' : 'bg-[var(--color-txt3)]'}`}></span>
            {typing ? 'Typing...' : 'Offline'}
          </div>
        </div>
        <span className="hidden items-center gap-1 text-[11px] font-bold text-[var(--color-green)] bg-[var(--color-green-bg)] border border-[var(--color-green)] rounded-full px-2 py-0.5 cursor-default" id="dm-e2e-badge">
          🔒 End-to-end encrypted
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1.5" id="dm-messages">
        {hasMore && (
          <button
            onClick={loadMoreMessages}
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
            divider = <div className="text-center text-[11px] font-bold text-[var(--color-txt3)] uppercase tracking-wide my-2.5">{dateStr}</div>;
          }
          const displayText = msg._plain !== undefined ? msg._plain : msg.body;
          const isE2E = msg.body && msg.body.startsWith('e2e:');
          const isTmp = String(msg.id).startsWith('tmp_');
          const editedLabel = msg.edited_at ? <span className="text-[10px] text-[var(--color-txt3)] ml-1">edited</span> : null;
          const seenLabel = (mine && !isTmp && msg.id === lastSentId && msg.is_read)
            ? <div className="text-[11px] font-medium text-[var(--color-txt3)] text-right mt-1 mr-0.5">Seen</div>
            : null;

          // ✅ Unique key: id + timestamp + temp flag
          const key = `${msg.id}-${msg.created_at}-${isTmp ? 'tmp' : 'real'}`;

          return (
            <Fragment key={key}>
              {divider}
              <div className={`flex ${mine ? 'flex-row-reverse' : ''} items-end gap-2 animate-fadeUp`}>
                {mine && !isTmp && (
                  <div className="relative">
                    <button
                      className="text-[var(--color-txt3)] text-base px-1.5 rounded-full opacity-0 hover:opacity-100 transition"
                      onClick={() => alert('Edit/Delete')}
                    >
                      ⋯
                    </button>
                  </div>
                )}
                <div
                  className={`max-w-[90%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                    mine
                      ? 'bg-[var(--color-accent)] text-white rounded-br-[5px] shadow-md shadow-[var(--color-accent-glow)]'
                      : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-txt)] rounded-bl-[5px]'
                  }`}
                >
                  <div dangerouslySetInnerHTML={{ __html: escHtml(displayText).replace(/\n/g, '<br>') }} />
                  {editedLabel}
                  <div className={`text-[10px] mt-1 opacity-60 ${mine ? 'text-right' : 'text-left'}`}>
                    {fmtTime(msg.created_at)}
                    {isE2E && ' 🔒'}
                  </div>
                </div>
                {seenLabel}
              </div>
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose */}
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
    </>
  );
}