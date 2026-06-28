// src/app/dashboard/DashboardClient.jsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/contexts/NotificationContext';
import { useDm } from '@/contexts/DmContext';
import { useWhisper } from '@/contexts/WhisperContext';
import { useGroups } from '@/contexts/GroupsContext';
import { useLive } from '@/contexts/LiveContext';
import { useExplore } from '@/contexts/ExploreContext';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function StatCard({ label, value, icon, link, color = 'var(--color-accent)' }) {
  return (
    <Link
      href={link || '#'}
      className="block p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl hover:shadow-[var(--color-shadow)] transition"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ background: color + '20', color }}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-head font-bold text-[var(--color-txt)]">{value}</div>
          <div className="text-sm text-[var(--color-txt2)]">{label}</div>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardClient() {
  const { user } = useAuth();
  const router = useRouter();
  const { unreadCount } = useNotifications();
  const { inbox } = useDm();
  const { messages: whisperMessages } = useWhisper();
  const { myGroups } = useGroups();
  const { activeSessions } = useLive();
  const { topics } = useExplore();

  const [totalPosts, setTotalPosts] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ── Fetch profile stats ──
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    const fetchStats = async () => {
      try {
        const res = await apiClient(`/api/users/${user.id}/profile`);
        const profile = res.data || res;
        setTotalPosts(profile.postCount || 0);
        setFollowerCount(profile.followerCount || 0);
        setFollowingCount(profile.followingCount || 0);
      } catch (_) {
        // fallback
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user, router]);

  // ── Unread whispers ──
  const unreadWhispers = whisperMessages.filter((m) => !m.read).length;

  // ── Unread DMs ──
  const unreadDMs = inbox.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);

  // ── Stats ──
  const stats = [
    {
      label: 'Posts',
      value: totalPosts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
      ),
      link: '/profile',
      color: 'var(--color-accent)',
    },
    {
      label: 'Followers',
      value: followerCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      link: '/profile',
      color: 'var(--color-green)',
    },
    {
      label: 'Following',
      value: followingCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      link: '/profile',
      color: 'var(--color-rose)',
    },
    {
      label: 'Notifications',
      value: unreadCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
      link: '#',
      color: 'var(--color-rose)',
    },
  ];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-6">Dashboard</h1>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => router.push('/compose')}
          className="flex items-center justify-center gap-2 p-3 bg-[var(--color-accent)] text-white rounded-xl font-semibold hover:bg-[var(--color-accent-h)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Post
        </button>
        <Link
          href="/messages"
          className="flex items-center justify-center gap-2 p-3 border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-txt2)] hover:bg-[var(--color-surface)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Messages {unreadDMs > 0 && `(${unreadDMs})`}
        </Link>
        <Link
          href="/whisper/inbox"
          className="flex items-center justify-center gap-2 p-3 border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-txt2)] hover:bg-[var(--color-surface)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            <line x1="9" y1="10" x2="15" y2="10" />
            <line x1="9" y1="14" x2="13" y2="14" />
          </svg>
          Whisper {unreadWhispers > 0 && `(${unreadWhispers})`}
        </Link>
        <button
          onClick={() => router.push('/live')}
          className="flex items-center justify-center gap-2 p-3 border border-[var(--color-border)] rounded-xl font-medium text-[var(--color-txt2)] hover:bg-[var(--color-surface)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Go Live
        </button>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Live streams + Groups */}
        <div className="space-y-6">
          {/* Live streams */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <h2 className="font-head font-bold text-[var(--color-txt)] mb-3">🔴 Live Streams</h2>
            {activeSessions.length === 0 ? (
              <p className="text-sm text-[var(--color-txt2)]">No one is live right now.</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.slice(0, 3).map((session) => (
                  <Link
                    key={session.sessionId}
                    href={`/live/${session.sessionId}`}
                    className="flex items-center gap-3 p-2 hover:bg-[var(--color-surface)] rounded-lg transition"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white text-xs font-bold">
                      {session.broadcasterName?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--color-txt)] truncate">
                        {session.broadcasterName || 'Unknown'}
                      </div>
                      <div className="text-xs text-[var(--color-txt2)] truncate">
                        {session.title || 'Live stream'}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-rose-500 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {session.viewerCount || 0}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Groups */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head font-bold text-[var(--color-txt)]">👥 Your Groups</h2>
              <Link href="/groups" className="text-xs text-[var(--color-accent)] hover:underline">
                View all
              </Link>
            </div>
            {myGroups.length === 0 ? (
              <p className="text-sm text-[var(--color-txt2)]">You haven't joined any groups yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {myGroups.slice(0, 6).map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full text-sm text-[var(--color-txt)] hover:bg-[var(--color-accent-bg)] transition"
                  >
                    {group.displayName || '#' + group.topic}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Trending topics */}
        <div className="space-y-6">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-head font-bold text-[var(--color-txt)]">🔥 Trending Topics</h2>
              <Link href="/explore" className="text-xs text-[var(--color-accent)] hover:underline">
                Explore
              </Link>
            </div>
            {topics.length === 0 ? (
              <p className="text-sm text-[var(--color-txt2)]">No trending topics yet.</p>
            ) : (
              <div className="space-y-2">
                {topics.slice(0, 5).map((topic) => (
                  <Link
                    key={topic.topic}
                    href={`/topic/${encodeURIComponent(topic.topic)}`}
                    className="flex items-center justify-between p-2 hover:bg-[var(--color-surface)] rounded-lg transition"
                  >
                    <span className="text-sm text-[var(--color-txt)]">#{topic.topic}</span>
                    <span className="text-xs text-[var(--color-txt2)]">{topic.post_count} posts</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}