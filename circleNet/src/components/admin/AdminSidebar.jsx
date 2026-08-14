// src/components/admin/AdminSidebar.jsx
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useState, useEffect } from 'react';

// ─── Icons ──────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const PostsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const ReportsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const AdsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── AdminSidebar Component ────────────────────────────────────────────

export default function AdminSidebar({ 
  isOpen = false, 
  onClose = null,
  className = '',
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('circle_admin_token');
    localStorage.removeItem('circle_admin');
    router.push('/admin/login');
  };

  const handleNavigate = (href) => {
    router.push(href);
    if (onClose) onClose();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, href: '/admin' },
    { id: 'users', label: 'Users', icon: UsersIcon, href: '/admin/users' },
    { id: 'posts', label: 'Posts', icon: PostsIcon, href: '/admin/posts' },
    { id: 'reports', label: 'Reports', icon: ReportsIcon, href: '/admin/reports' },
  ];

  const managementItems = [
    { id: 'ads', label: 'Ads', icon: AdsIcon, href: '/admin/ads' },
  ];

  const accountItems = [
    { id: 'settings', label: 'Settings', icon: SettingsIcon, href: '/admin/settings' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'A';

  // Determine if a nav item is active
  const isActive = (href) => {
    if (href === '/admin' && pathname === '/admin') return true;
    if (href !== '/admin' && pathname?.startsWith(href)) return true;
    return false;
  };

  return (
    <>
      {/* ─── Overlay for mobile ─── */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => onClose && onClose()}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside className={`
        fixed left-0 top-0 h-full w-[260px] bg-[var(--color-card)] border-r border-[var(--color-border)] 
        flex flex-col z-50 transition-transform duration-300
        ${isOpen || !isMobile ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${className}
      `}>
        {/* Brand with Close Button */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--color-txt)]">Circle</span>
            <span className="text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-0.5 rounded-full">Admin</span>
          </div>
          
          {/* Close Button - Only visible on mobile */}
          <button
            onClick={() => onClose && onClose()}
            className="md:hidden p-1.5 rounded-lg text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Main Section */}
          <div className="text-[10px] font-semibold text-[var(--color-txt3)] uppercase tracking-wider px-3 mb-2">Main</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.href)}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition mb-0.5
                ${isActive(item.href) 
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                  : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)]'
                }
              `}
            >
              <item.icon />
              {item.label}
            </button>
          ))}

          {/* Management Section */}
          {managementItems.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-[var(--color-txt3)] uppercase tracking-wider px-3 mt-4 mb-2">Management</div>
              {managementItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.href)}
                  className={`
                    flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition mb-0.5
                    ${isActive(item.href) 
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                      : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)]'
                    }
                  `}
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
            </>
          )}

          {/* Account Section */}
          <div className="text-[10px] font-semibold text-[var(--color-txt3)] uppercase tracking-wider px-3 mt-4 mb-2">Account</div>
          {accountItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.href)}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition mb-0.5
                ${isActive(item.href) 
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' 
                  : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)]'
                }
              `}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
          
          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition text-[var(--color-txt2)] hover:text-rose-500 hover:bg-rose-500/10 mt-0.5"
          >
            <LogoutIcon />
            Logout
          </button>
        </nav>

        {/* Footer - User Info */}
        <div className="border-t border-[var(--color-border)] px-4 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-txt)] truncate">{user?.name || 'Admin'}</div>
              <div className="text-xs text-[var(--color-txt3)]">Super Admin</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}