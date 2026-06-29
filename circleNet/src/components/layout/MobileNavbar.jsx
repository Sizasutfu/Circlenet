// src/components/layout/MobileNavbar.jsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/contexts/NotificationContext';
import { useDm } from '@/contexts/DmContext';

export default function MobileNavbar({ className = '' }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { openPanel, unreadCount } = useNotifications();
  const { inbox } = useDm();

  const dmUnread = inbox.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);

  // ── Exactly 5 items ──
  const navItems = [
    { id: 'feed', label: 'Feed', icon: HomeIcon, href: '/' },
    { id: 'explore', label: 'Explore', icon: ExploreIcon, href: '/explore' },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: BellIcon,
      href: '#',
      badge: unreadCount,
      onClick: () => {
        if (!user) {
          router.push('/login');
          return;
        }
        openPanel();
      },
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageIcon,
      href: '/messages',
      badge: dmUnread,
    },
    { id: 'profile', label: 'Profile', icon: UserIcon, href: '/profile' },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-card)] border-t border-[var(--color-border)] flex items-center justify-around px-2 py-1.5 md:hidden safe-bottom ${className}`}
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.id === 'notifications') {
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 relative"
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt3)]'}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt2)]'}`}>
                {item.label}
              </span>
              {item.badge > 0 && (
                <span className="absolute top-0 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-rose)] px-1 text-[10px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-3 relative"
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt3)]'}`} />
            <span className={`text-[10px] font-medium ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt2)]'}`}>
              {item.label}
            </span>
            {item.badge > 0 && (
              <span className="absolute top-0 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--color-rose)] px-1 text-[10px] font-bold text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// ── Icons ──
const HomeIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ExploreIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const BellIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const MessageIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const UserIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);