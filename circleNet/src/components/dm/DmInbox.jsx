// src/components/dm/DmInbox.jsx
'use client';

import { useState } from 'react';
import { useDm } from '@/contexts/DmContext';
import { useAuth } from '@/lib/auth';

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export default function DmInbox() {
  const { user } = useAuth();
  const { inbox, activeConvId, openConversation } = useDm();
  const [filter, setFilter] = useState('');

  const filtered = inbox.filter(
    (c) => c.other_name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[var(--color-border)] flex-shrink-0">
        <h2 className="font-head text-lg font-extrabold text-[var(--color-txt)] mb-3">
          Messages
        </h2>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-txt3)] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search messages"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full py-2 pl-10 pr-4 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-2">
        {!user ? (
          <div className="text-center py-12 px-4 text-[var(--color-txt2)]">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-[var(--color-txt3)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm">Log in to use messages</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4 text-[var(--color-txt2)]">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-[var(--color-txt3)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm">
              {filter ? 'No conversations match your search' : 'No conversations yet.'}
              <br />
              {!filter && 'Start one!'}
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const unread = conv.unread_count || 0;
            const initial = (conv.other_name || '?').charAt(0).toUpperCase();
            const color = stringToColor(conv.other_name || '');
            const isActive = conv.id === activeConvId;
            const preview = conv.last_message
              ? (conv.last_sender_id === user?.id ? 'You: ' : '') + conv.last_message
              : 'No messages yet';
            const timeStr = conv.last_message_at
              ? new Date(conv.last_message_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={conv.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[var(--color-accent-bg)]'
                    : 'hover:bg-[var(--color-surface)]'
                } ${unread ? 'font-bold' : ''}`}
                onClick={() => openConversation(conv.id)}
              >
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    background: conv.other_picture ? 'transparent' : color,
                    overflow: 'hidden',
                  }}
                >
                  {conv.other_picture ? (
                    <img
                      src={conv.other_picture}
                      alt={initial}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    initial
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-txt)] truncate">
                    {conv.other_name}
                  </div>
                  <div className="text-xs text-[var(--color-txt3)] truncate">
                    {preview.slice(0, 60)}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {timeStr && (
                    <div className="text-[10px] text-[var(--color-txt3)]">
                      {timeStr}
                    </div>
                  )}
                  {unread > 0 && (
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Message Button */}
      <button
        onClick={() => document.getElementById('dm-new-modal').classList.add('open')}
        className="mx-4 mb-4 py-2.5 px-4 bg-[var(--color-accent)] text-white rounded-full text-sm font-semibold hover:bg-[var(--color-accent-h)] transition shadow-md shadow-[var(--color-accent-glow)] border-none cursor-pointer"
      >
        + New Message
      </button>
    </div>
  );
}