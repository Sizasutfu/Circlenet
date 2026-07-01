// src/app/messages/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useDm } from '@/contexts/DmContext';
import DmInbox from '@/components/dm/DmInbox';
import DmChat from '@/components/dm/DmChat';
import DmNewModal from '@/components/dm/DmNewModal';

export default function MessagesPage() {
  const { user } = useAuth();
  const { activeConvId } = useDm();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!user) {
    return (
      <div className="p-8 text-center text-[var(--color-txt2)]">
        <p>Please log in to view your messages.</p>
      </div>
    );
  }

  const showInbox = !isMobile || !activeConvId;
  const showChat = !isMobile || activeConvId;

  return (
    <div className="h-[calc(100vh-60px)] min-h-0 overflow-hidden border border-[var(--color-border)] rounded-[var(--radius-radius)] bg-[var(--color-card)] flex">
      {/* Inbox – full width on mobile, 300px on desktop */}
      <div
        className={`w-full max-w-full min-w-0 md:w-[300px] md:max-w-[300px] flex-shrink-0 border-r border-[var(--color-border)] overflow-hidden ${
          showInbox ? 'flex' : 'hidden md:flex'
        }`}
      >
        <DmInbox />
      </div>

      {/* Chat panel */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-[var(--color-card)] overflow-hidden ${
          showChat ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConvId ? (
          <DmChat />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-txt2)] gap-3 p-8">
            <svg
              className="w-14 h-14 text-[var(--color-txt3)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <h3 className="font-head text-lg font-extrabold text-[var(--color-txt)]">
              Select a conversation
            </h3>
            <p className="text-sm text-center max-w-[220px] leading-relaxed">
              Choose someone from your inbox or start a new one.
            </p>
          </div>
        )}
      </div>

      {/* New Conversation Modal */}
      <DmNewModal />
    </div>
  );
}