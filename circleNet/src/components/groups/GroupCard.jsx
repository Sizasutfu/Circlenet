// src/components/groups/GroupCard.jsx
'use client';

import { useGroups } from '@/contexts/GroupsContext';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { useState, useEffect } from 'react';

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

const GROUP_GRADIENTS = [
  'linear-gradient(160deg,#16151f 0%,#1e1c2a 100%)',
  'linear-gradient(160deg,#131a1e 0%,#192025 100%)',
  'linear-gradient(160deg,#1e1518 0%,#251c20 100%)',
  'linear-gradient(160deg,#1a1710 0%,#221e14 100%)',
  'linear-gradient(160deg,#121620 0%,#181d28 100%)',
  'linear-gradient(160deg,#141a18 0%,#1b2220 100%)',
];

function groupGradient(topic) {
  let h = 0;
  for (let i = 0; i < (topic || '').length; i++) {
    h = (h * 31 + topic.charCodeAt(i)) & 0xffff;
  }
  return GROUP_GRADIENTS[h % GROUP_GRADIENTS.length];
}

export default function GroupCard({ group }) {
  const { user } = useAuth();
  const { joinGroup, leaveGroup, myGroups, refreshKey } = useGroups();

  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  // Update local state when group prop or myGroups changes
  useEffect(() => {
    if (group) {
      // Check if user is a member from myGroups
      const isUserMember = myGroups.some(g => g.id === group.id);
      const finalIsMember = isUserMember || group.isMember || false;
      
      // Debug logging
      console.log(`[GroupCard] Group ${group.id} (${group.topic}):`, {
        fromMyGroups: isUserMember,
        fromGroupProp: group.isMember,
        finalIsMember: finalIsMember,
        myGroupsCount: myGroups.length
      });
      
      setIsMember(finalIsMember);
      setMemberCount(group.memberCount || 0);
    }
  }, [group, myGroups, refreshKey]);

  const handleJoin = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || isJoining) return;

    setIsJoining(true);
    const wasMember = isMember;

    try {
      if (isMember) {
        console.log(`[GroupCard] Leaving group ${group.id}`);
        await leaveGroup(group.id);
        setIsMember(false);
        setMemberCount(prev => Math.max(0, prev - 1));
      } else {
        console.log(`[GroupCard] Joining group ${group.id}`);
        await joinGroup(group.id);
        setIsMember(true);
        setMemberCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('Error toggling membership:', err);
      setIsMember(wasMember);
      setMemberCount(group.memberCount || 0);
    } finally {
      setIsJoining(false);
    }
  };

  if (!group) return null;

  const grad = groupGradient(group.topic);

  const coverHtml = group.coverImage ? (
    <img
      src={group.coverImage}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: grad }}
    >
      <svg
        width="32"
        height="32"
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    </div>
  );

  return (
    <Link href={`/groups/${group.id}`} className="block">
      <div className="group-card cursor-pointer overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] transition-shadow duration-200 hover:shadow-[var(--color-shadow)]">
        <div className="relative h-20 overflow-hidden">
          {coverHtml}
        </div>

        <div className="p-4">
          <div className="truncate font-semibold text-[var(--color-txt)]">
            {group.displayName || `#${group.topic}`}
          </div>

          <div className="line-clamp-2 h-10 text-sm text-[var(--color-txt2)]">
            {group.description || ''}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-txt3)]">
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              {fmtNum(memberCount)}
            </span>

            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
              {fmtNum(group.postCount || 0)}
            </span>
          </div>

          <button
            onClick={handleJoin}
            disabled={isJoining || !user}
            className={`mt-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              isMember
                ? 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-txt2)]'
                : 'bg-[var(--color-accent)] text-white'
            }`}
          >
            {isJoining ? '...' : isMember ? '✓ Joined' : 'Join'}
          </button>
        </div>
      </div>
    </Link>
  );
}