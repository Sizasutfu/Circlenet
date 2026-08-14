// src/components/dm/DmInbox.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDm } from '@/contexts/DmContext';
import { useAuth } from '@/lib/auth';
import { useWs } from '@/contexts/WsContext';
import { apiClient } from '@/lib/api';
import * as E2E from '@/lib/e2e';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import VerificationBadge from '@/components/ui/VerificationBadge';

export default function DmInbox() {
  const { user } = useAuth();
  const { inbox, activeConvId, openConversation, e2eEnabled } = useDm();
  const { registerHandler } = useWs();
  const router = useRouter();
  const [filter, setFilter] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [decryptedPreviews, setDecryptedPreviews] = useState({});

  // ─── Decrypt message preview ──────────────────────────────────
  const decryptPreview = async (conv) => {
    if (!conv || !conv.last_message) return;
    
    // Skip if not encrypted
    if (!conv.last_message.startsWith('e2e:')) {
      setDecryptedPreviews(prev => ({
        ...prev,
        [conv.id]: conv.last_message
      }));
      return;
    }

    // Check if already decrypted
    if (decryptedPreviews[conv.id]) return;

    try {
      const decrypted = await E2E.decrypt(conv.other_id, conv.last_message, apiClient);
      setDecryptedPreviews(prev => ({
        ...prev,
        [conv.id]: decrypted || '[Unable to decrypt]'
      }));
    } catch (err) {
      console.error('[DM] Inbox decryption error:', err);
      setDecryptedPreviews(prev => ({
        ...prev,
        [conv.id]: '🔒 Encrypted message'
      }));
    }
  };

  // ─── Decrypt all inbox messages ─────────────────────────────
  useEffect(() => {
    if (!inbox || !inbox.length) return;

    inbox.forEach(conv => {
      if (conv.last_message && conv.last_message.startsWith('e2e:')) {
        decryptPreview(conv);
      } else if (conv.last_message) {
        // Plaintext message - store as-is
        setDecryptedPreviews(prev => ({
          ...prev,
          [conv.id]: conv.last_message
        }));
      }
    });
  }, [inbox]);

  // ─── Refresh decrypted preview when inbox updates ──────────
  useEffect(() => {
    if (!inbox || !inbox.length) return;
    
    inbox.forEach(conv => {
      if (conv.last_message && conv.last_message.startsWith('e2e:')) {
        const cacheKey = `${conv.id}_${conv.last_message}`;
        const cached = sessionStorage.getItem(`dm_preview_${cacheKey}`);
        
        if (cached) {
          setDecryptedPreviews(prev => ({
            ...prev,
            [conv.id]: cached
          }));
        } else {
          decryptPreview(conv);
        }
      }
    });
  }, [inbox]);

  // ─── Track typing indicators ──────────────────────────────
  useEffect(() => {
    const unregTyping = registerHandler('typing', (data) => {
      if (!data || !data.conversationId) return;
      
      setTypingUsers((prev) => {
        const key = `${data.conversationId}_${data.userId}`;
        if (data.isTyping) {
          const timeoutId = setTimeout(() => {
            setTypingUsers((current) => {
              const newState = { ...current };
              delete newState[key];
              return newState;
            });
          }, 3000);
          
          return { ...prev, [key]: { ...data, timeoutId } };
        } else {
          if (prev[key]?.timeoutId) {
            clearTimeout(prev[key].timeoutId);
          }
          const newState = { ...prev };
          delete newState[key];
          return newState;
        }
      });
    });

    return () => {
      unregTyping();
      Object.values(typingUsers).forEach((item) => {
        if (item.timeoutId) clearTimeout(item.timeoutId);
      });
    };
  }, [registerHandler]);

  // ─── Check if a user is typing ─────────────────────────────
  const isTypingInConversation = (conversationId, otherId) => {
    const key = `${conversationId}_${otherId}`;
    return !!typingUsers[key];
  };

  // ─── Get display text for a message ─────────────────────────
  const getDisplayText = (conv) => {
    if (!conv || !conv.last_message) return null;
    
    // If it's encrypted, use decrypted version
    if (conv.last_message.startsWith('e2e:')) {
      return decryptedPreviews[conv.id] || null;
    }
    
    // Plaintext message
    return conv.last_message;
  };

  const filtered = inbox.filter(
    (c) => c.other_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const openNewModal = () => {
    const modal = document.getElementById('dm-new-modal');
    if (modal) modal.classList.remove('hidden');
  };

  return (
    <div className="flex flex-col h-full w-full min-w-0 max-w-full overflow-x-hidden overflow-y-hidden bg-[var(--color-surface)]">
      {/* ─── Header ─── */}
      <div className="flex-shrink-0 flex items-center gap-2 p-3 sm:p-4 pb-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => router.back()}
          className="p-1 rounded-full hover:bg-[var(--color-accent-bg)] transition flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="font-head text-lg font-extrabold text-[var(--color-txt)] flex-1">
          Messages
        </h2>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-txt3)] hidden sm:inline">
            {e2eEnabled ? '🔒 E2E' : ''}
          </span>
          <button
            onClick={openNewModal}
            className="flex-shrink-0 py-1.5 px-4 bg-[var(--color-accent)] text-white rounded-full text-sm font-semibold hover:bg-[var(--color-accent-h)] transition shadow-md shadow-[var(--color-accent-glow)] border-none cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New
          </button>
        </div>
      </div>

      {/* ─── Search bar ─── */}
      <div className="flex-shrink-0 px-3 sm:px-4 pb-3 pt-3">
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

      {/* ─── Conversation list ─── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 min-w-0">
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
            const isActive = conv.id === activeConvId;
            const isTyping = isTypingInConversation(conv.id, conv.other_id);
            
            // Get the display text (decrypted if needed)
            const displayText = getDisplayText(conv);
            
            // Build preview text
            let preview = 'No messages yet';
            if (isTyping) {
              preview = `${conv.other_name || 'Someone'} is typing...`;
            } else if (displayText) {
              const sender = conv.last_sender_id === user?.id ? 'You: ' : '';
              const mediaIcon = conv.last_media_type ? '📎 ' : '';
              preview = sender + mediaIcon + displayText;
            }
            
            const timeStr = conv.last_message_at
              ? new Date(conv.last_message_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            let isOtherVerified = false;
            if (conv.other) {
              isOtherVerified = !!conv.other.verified;
            } else if (conv.other_verified !== undefined) {
              isOtherVerified = !!conv.other_verified;
            } else if (conv.verified !== undefined) {
              isOtherVerified = !!conv.verified;
            }

            return (
              <div
                key={conv.id}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 cursor-pointer transition-colors w-full min-w-0 max-w-full ${
                  isActive
                    ? 'bg-[var(--color-accent-bg)]'
                    : 'hover:bg-[var(--color-surface)]'
                } ${unread ? 'font-bold' : ''}`}
                onClick={() => openConversation(conv.id)}
              >
                {conv.other_picture ? (
                  <img
                    src={conv.other_picture}
                    alt={conv.other_name || 'User'}
                    className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
                  />
                ) : (
                  <AvatarPlaceholder size="w-9 h-9 sm:w-10 sm:h-10" />
                )}

                <div className="flex-1 min-w-0 basis-0 overflow-hidden">
                  {/* ─── Name row ─── */}
                  <div className="text-sm font-semibold text-[var(--color-txt)] truncate flex items-center gap-1">
                    {conv.other_name}
                    {isOtherVerified && <VerificationBadge size="w-3.5 h-3.5" />}
                  </div>
                  
                  {/* ─── Preview row ─── */}
                  <div className={`text-xs truncate block max-w-full ${
                    isTyping 
                      ? 'text-[var(--color-green)] italic animate-pulse' 
                      : 'text-[var(--color-txt3)]'
                  }`}>
                    {preview}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-1 sm:ml-2 w-10 sm:w-auto">
                  {timeStr && !isTyping && (
                    <div className="text-[10px] text-[var(--color-txt3)] whitespace-nowrap">
                      {timeStr}
                    </div>
                  )}
                  {isTyping && (
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 bg-[var(--color-green)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 bg-[var(--color-green)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 bg-[var(--color-green)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                  {unread > 0 && !isTyping && (
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}