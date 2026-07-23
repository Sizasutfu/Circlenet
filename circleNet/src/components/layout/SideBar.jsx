// src/components/layout/SideBar.jsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/contexts/NotificationContext";
import { useLive } from "@/contexts/LiveContext";
import { useDm } from "@/contexts/DmContext";
import { useState, useEffect } from "react";
import AvatarPlaceholder from "@/components/ui/AvatarPlaceholder";
import VerificationBadge from "@/components/ui/VerificationBadge";
import { apiClient } from "@/lib/api";
import { resolveMediaUrl } from '@/lib/url';
import { useLightbox } from '@/hooks/useLightbox';

// ── Icons ──
const HomeIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const DashboardIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const UserIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const SearchIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ExploreIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const VideosIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const GroupsIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const ArticlesIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M4 4h16v4H4z" />
    <path d="M4 12h10" />
    <path d="M4 16h7" />
    <rect x="14" y="11" width="6" height="9" rx="1" />
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

const WhisperIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    <line x1="9" y1="10" x2="15" y2="10" />
    <line x1="9" y1="14" x2="13" y2="14" />
  </svg>
);

const SettingsIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const LiveIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
    <rect x="2" y="7" width="13" height="10" rx="2" ry="2" />
    <circle cx="6" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="11" cy="5" r="1" fill="currentColor" stroke="none" />
    <line x1="6" y1="5" x2="11" y2="5" strokeWidth="1.5" />
  </svg>
);

const AdminIcon = (props) => (
  <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

export default function SideBar({ isOpen = false, onClose = () => {} }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { openPanel, unreadCount: notifUnreadCount } = useNotifications();
  const { openSetup } = useLive();
  const { unreadCount: dmUnreadCount } = useDm();
  const { openLightbox } = useLightbox();

  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingVerified, setLoadingVerified] = useState(true);

  useEffect(() => {
    const fetchVerifiedAndRole = async () => {
      if (!user?.id) {
        setIsVerified(false);
        setIsAdmin(false);
        setLoadingVerified(false);
        return;
      }

      if (user.verified !== undefined && user.role !== undefined) {
        setIsVerified(user.verified === 1 || user.verified === true);
        setIsAdmin(user.role === 'admin');
        setLoadingVerified(false);
        return;
      }

      try {
        const res = await apiClient(`/api/users/${user.id}/profile`);
        const profile = res.data || res;
        setIsVerified(profile.verified === 1 || profile.verified === true);
        setIsAdmin(profile.role === 'admin');
      } catch (err) {
        console.warn("Failed to fetch profile:", err);
        setIsVerified(false);
        setIsAdmin(false);
      } finally {
        setLoadingVerified(false);
      }
    };
    fetchVerifiedAndRole();
  }, [user]);

  // ── Algorithmic video feed ──
  const handleVideosClick = async () => {
    try {
      const res = await apiClient('/api/videos?limit=20');
      const videos = res.data?.posts || res.data || [];
      const validVideos = videos.filter(v => v.video);
      if (!validVideos.length) {
        alert('No videos found.');
        return;
      }

      const items = validVideos.map((v) => ({
        src: resolveMediaUrl(v.video) || '',
        type: 'video',
        meta: {
          postId: v.id,
          caption: v.text || '',
          name: v.user?.name || v.author || 'Anonymous',
          username: v.user?.username || '',
          userId: v.user?.id || v.authorId || v.userId,
          picture: resolveMediaUrl(v.user?.picture || v.authorPicture || null),
          poster: resolveMediaUrl(v.image || v.thumbnail || null),
        },
      }));

      localStorage.setItem('circle_lb_nav_axis', 'ud');
      openLightbox(items, 0);
    } catch (err) {
      console.error('Failed to load videos:', err);
      alert('Could not load videos.');
    }
  };

  const navItems = [
    { id: "feed", label: "Feed", icon: HomeIcon, href: "/" },
    { id: "profile", label: "Profile", icon: UserIcon, href: "/profile" },
    { id: "search", label: "Search", icon: SearchIcon, href: "/search" },
    { id: "explore", label: "Explore", icon: ExploreIcon, href: "/explore" },
    { id: "videos", label: "Videos", icon: VideosIcon, onClick: handleVideosClick },
    { id: "groups", label: "Groups", icon: GroupsIcon, href: "/groups" },
    { id: "articles", label: "Articles", icon: ArticlesIcon, href: "/articles" },
    {
      id: "notifications",
      label: "Notifications",
      icon: BellIcon,
      href: "#",
      badge: notifUnreadCount,
      onClick: openPanel,
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageIcon,
      href: "/messages",
      badge: dmUnreadCount,
    },
    { id: "whisper", label: "Whisper", icon: WhisperIcon, href: "/whisper/inbox" },
    { id: "settings", label: "Settings", icon: SettingsIcon, href: "/settings" },
    ...(isAdmin
      ? [
          {
            id: "admin-dashboard",
            label: "Admin Dashboard",
            icon: AdminIcon,
            href: "/admin",
          },
        ]
      : []),
    {
      id: "dashboard",
      label: "Dashboard",
      icon: DashboardIcon,
      href: "/dashboard",
    },
    ...(isVerified
      ? [
          {
            id: "live",
            label: "Go Live",
            icon: LiveIcon,
            onClick: openSetup,
            isLive: true,
          },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 768) onClose();
  };

  const avatarUrl = user?.picture ? resolveMediaUrl(user.picture) : null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col bg-[var(--color-card)] border-r border-[var(--color-border)] shadow-[var(--color-shadow)] transform transition-transform duration-300 ease-in-out overflow-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-md shadow-[var(--color-accent-glow)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-h)] bg-clip-text text-transparent">
            Circlenet
          </span>
        </div>

        {/* ── Navigation (scrollable, scrollbar hidden) ── */}
        <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-1 min-h-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            if (item.external) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLinkClick}
                  className="group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--color-txt2)] transition-all hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-txt)]"
                >
                  <Icon className="h-5 w-5 flex-shrink-0 text-[var(--color-txt3)] group-hover:text-[var(--color-txt)]" />
                  <span className="flex-1 text-left">{item.label}</span>
                </a>
              );
            }

            if (item.isLive) {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick?.();
                    handleLinkClick();
                  }}
                  className="group relative flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-3 text-sm font-medium text-white shadow-md shadow-rose-500/30 transition-all hover:shadow-lg hover:shadow-rose-500/50 hover:scale-[1.02] active:scale-[0.98] w-full text-left"
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
                  </span>
                </button>
              );
            }

            // ── Videos – button ──
            if (item.id === "videos") {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick?.();
                    handleLinkClick();
                  }}
                  className={`
                    group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all w-full text-left
                    ${
                      pathname === "/videos"
                        ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]"
                        : "text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-txt)]"
                    }
                  `}
                >
                  <Icon
                    className={`
                      h-5 w-5 flex-shrink-0 transition-colors
                      ${
                        pathname === "/videos"
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-txt3)] group-hover:text-[var(--color-txt)]"
                      }
                    `}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {pathname === "/videos" && (
                    <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]" />
                  )}
                </button>
              );
            }

            // ── Notifications ──
            if (item.id === "notifications") {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.onClick?.();
                    handleLinkClick();
                  }}
                  className={`
                    group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all w-full text-left
                    ${
                      isActive
                        ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]"
                        : "text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-txt)]"
                    }
                  `}
                >
                  <Icon
                    className={`
                      h-5 w-5 flex-shrink-0 transition-colors
                      ${
                        isActive
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-txt3)] group-hover:text-[var(--color-txt)]"
                      }
                    `}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-rose)] px-1.5 text-xs font-semibold text-white shadow-sm shadow-[var(--color-rose-bg)]">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]" />
                  )}
                </button>
              );
            }

            // ── Regular Links ──
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={handleLinkClick}
                className={`
                  group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]"
                      : "text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)] hover:text-[var(--color-txt)]"
                  }
                `}
              >
                <Icon
                  className={`
                    h-5 w-5 flex-shrink-0 transition-colors
                    ${
                      isActive
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-txt3)] group-hover:text-[var(--color-txt)]"
                    }
                  `}
                />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-rose)] px-1.5 text-xs font-semibold text-white shadow-sm shadow-[var(--color-rose-bg)]">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[var(--color-accent)] shadow-sm shadow-[var(--color-accent-glow)]" />
                )}
              </Link>
            );
          })}

          <div className="my-3 border-t border-[var(--color-border)]" />

          <Link
            href="/compose"
            onClick={handleLinkClick}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-accent)]/30 bg-[var(--color-accent-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-accent)] transition-all hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent-bg)] hover:shadow-md hover:shadow-[var(--color-accent-glow)] active:scale-[0.98]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create a post</span>
          </Link>
        </nav>

        {/* ── Footer ── */}
        {user ? (
          <div className="border-t border-[var(--color-border)] p-4 flex-shrink-0 bg-[var(--color-card)]">
            <div className="flex items-center gap-3 rounded-xl bg-[var(--color-surface)] p-2 transition-colors hover:bg-[var(--color-accent-bg)]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="h-10 w-10 rounded-full object-cover flex-shrink-0 shadow-md shadow-[var(--color-accent-glow)]"
                />
              ) : (
                <AvatarPlaceholder size="h-10 w-10" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-txt)] truncate flex items-center gap-1">
                  {user.name}
                  {isVerified && <VerificationBadge size="w-3.5 h-3.5" />}
                </p>
                <p className="text-xs text-[var(--color-txt2)] truncate">
                  @{user.username || "user"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-[var(--color-txt3)] transition-colors hover:bg-[var(--color-rose-bg)] hover:text-[var(--color-rose)]"
                aria-label="Logout"
                title="Logout"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--color-border)] p-4 flex-shrink-0 bg-[var(--color-card)]">
            <Link
              href="/login"
              onClick={handleLinkClick}
              className="flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--color-accent-glow)] transition-all hover:shadow-lg hover:shadow-[var(--color-accent-glow)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}