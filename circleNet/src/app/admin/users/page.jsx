// src/app/admin/users/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

// ─── Icons (All SVG, No Emojis) ──────────────────────────────────────

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const MoreVerticalIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BanIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="22 3 2 3 10 13 10 21 14 18 14 13 22 3" />
  </svg>
);

const RefreshCwIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

// ─── Original VerifiedBadge (was working) ─────────────────────────────
const VerifiedBadge = () => (
  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const EmptyUsersIcon = () => (
  <svg className="w-12 h-12 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const PostIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const FollowersIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// ─── Components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const variants = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    suspended: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    admin: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    unverified: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };

  const labels = {
    active: 'Active',
    suspended: 'Suspended',
    admin: 'Admin',
    unverified: 'Unverified',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${variants[status] || variants.active}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Mobile User Card ───────────────────────────────────────────────────

function MobileUserCard({ user, onAction, currentUserId }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleAction = (action, data) => {
    setDropdownOpen(false);
    onAction(action, data);
  };

  const isCurrentUser = user.id === currentUserId;

  // 🔥 FIX: Proper initials calculation - no "0"
  const initials = user.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : '?';

  // 🔥 FIX: normalize booleans - MySQL tinyint columns come back as 1/0,
  // not true/false, so strict `=== true` checks silently fail and
  // `value && (...)` renders a literal "0" when the value is 0.
  const isVerified = user.verified === true || user.verified === 1;
  const isSuspended = user.suspended === true || user.suspended === 1;

  return (
    <div className="border-b border-[var(--color-border)] p-4 hover:bg-[var(--color-surface)] transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* User info */}
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-medium bg-[var(--color-accent-bg)] text-[var(--color-accent)] flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-[var(--color-txt)] truncate">{user.name}</span>
                {/* 🔥 FIX: Only show badge when verified (handles 1/0 and true/false) */}
                {isVerified && <VerifiedBadge />}
                {user.role === 'admin' && (
                  <span className="text-[10px] font-medium bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">Admin</span>
                )}
              </div>
              <div className="text-sm text-[var(--color-txt2)]">@{user.username}</div>
            </div>
          </div>

          {/* Email */}
          <div className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-txt)]">
            <MailIcon />
            <span className="truncate">{user.email || '—'}</span>
            {/* 🔥 FIX: Handle both 0/1 and true/false */}
            {user.email_verified == 1 || user.email_verified === true ? (
              <span className="text-xs text-green-500 ml-1">Verified</span>
            ) : (
              <span className="text-xs text-amber-500 ml-1">Unverified</span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-txt2)]">
            <span className="flex items-center gap-1">
              <PostIcon />
              {user.postCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <FollowersIcon />
              {user.followerCount || 0}
            </span>
            <span className="flex items-center gap-1">
              <CalendarIcon />
              {new Date(user.joinDate || user.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Status */}
          <div className="mt-2">
            <StatusBadge status={isSuspended ? 'suspended' : user.role === 'admin' ? 'admin' : 'active'} />
          </div>
        </div>

        {/* Actions dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={toggleDropdown}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
            disabled={isCurrentUser}
          >
            <MoreVerticalIcon />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[160px]">
              <button
                onClick={() => handleAction('view', user)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <EditIcon />
                View Profile
              </button>

              {!isSuspended && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('suspend', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
                >
                  <BanIcon />
                  Suspend User
                </button>
              )}

              {isSuspended && (
                <button
                  onClick={() => handleAction('unsuspend', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-500 hover:bg-green-500/10 transition text-left"
                >
                  <CheckIcon />
                  Unsuspend User
                </button>
              )}

              {/* 🔥 FIX: Only show verify when not verified */}
              {!isVerified && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('verify', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-500 hover:bg-blue-500/10 transition text-left"
                >
                  <ShieldIcon />
                  Verify User
                </button>
              )}

              {isVerified && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('unverify', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 transition text-left"
                >
                  <XIcon />
                  Remove Verification
                </button>
              )}

              {user.role !== 'admin' && (
                <>
                  <div className="border-t border-[var(--color-border)] my-1" />
                  <button
                    onClick={() => handleAction('delete', user)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
                  >
                    <TrashIcon />
                    Delete User
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop User Row ──────────────────────────────────────────────────

function DesktopUserRow({ user, onAction, currentUserId }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setDropdownOpen(!dropdownOpen);
  };

  const handleAction = (action, data) => {
    setDropdownOpen(false);
    onAction(action, data);
  };

  const isCurrentUser = user.id === currentUserId;

  // 🔥 FIX: Proper initials calculation - no "0"
  const initials = user.name 
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : '?';

  // 🔥 FIX: normalize booleans - MySQL tinyint columns come back as 1/0,
  // not true/false, so strict `=== true` checks silently fail and
  // `value && (...)` renders a literal "0" when the value is 0.
  const isVerified = user.verified === true || user.verified === 1;
  const isSuspended = user.suspended === true || user.suspended === 1;

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-[var(--color-accent-bg)] text-[var(--color-accent)] flex-shrink-0">
              {initials}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[var(--color-txt)]">{user.name}</span>
              {/* 🔥 FIX: Only show badge when verified (handles 1/0 and true/false) */}
              {isVerified && <VerifiedBadge />}
              {user.role === 'admin' && (
                <span className="text-[10px] font-medium bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded">Admin</span>
              )}
            </div>
            <div className="text-sm text-[var(--color-txt2)]">@{user.username}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-txt)]">
        <div className="flex flex-col">
          <span>{user.email || '—'}</span>
          {/* 🔥 FIX: Handle both 0/1 and true/false */}
          {user.email_verified == 1 || user.email_verified === true ? (
            <span className="text-xs text-green-500">Verified</span>
          ) : (
            <span className="text-xs text-amber-500">Unverified</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={isSuspended ? 'suspended' : user.role === 'admin' ? 'admin' : 'active'} />
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-txt2)]">
        {new Date(user.joinDate || user.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-txt2)] text-center">
        {user.postCount || 0}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-txt2)] text-center">
        {user.followerCount || 0}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="relative">
          <button
            onClick={toggleDropdown}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
            disabled={isCurrentUser}
          >
            <MoreVerticalIcon />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[180px]">
              <button
                onClick={() => handleAction('view', user)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition text-left"
              >
                <EditIcon />
                View Profile
              </button>

              {!isSuspended && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('suspend', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
                >
                  <BanIcon />
                  Suspend User
                </button>
              )}

              {isSuspended && (
                <button
                  onClick={() => handleAction('unsuspend', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-500 hover:bg-green-500/10 transition text-left"
                >
                  <CheckIcon />
                  Unsuspend User
                </button>
              )}

              {/* 🔥 FIX: Only show verify when not verified */}
              {!isVerified && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('verify', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-500 hover:bg-blue-500/10 transition text-left"
                >
                  <ShieldIcon />
                  Verify User
                </button>
              )}

              {isVerified && user.role !== 'admin' && (
                <button
                  onClick={() => handleAction('unverify', user)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-amber-500 hover:bg-amber-500/10 transition text-left"
                >
                  <XIcon />
                  Remove Verification
                </button>
              )}

              {user.role !== 'admin' && (
                <>
                  <div className="border-t border-[var(--color-border)] my-1" />
                  <button
                    onClick={() => handleAction('delete', user)}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition text-left"
                  >
                    <TrashIcon />
                    Delete User
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Confirm Dialog ──────────────────────────────────────────────────

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-head font-bold text-[var(--color-txt)]">{title}</h3>
        <p className="text-sm text-[var(--color-txt2)] mt-2">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:bg-[var(--color-surface)] transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
              danger ? 'bg-rose-500 hover:bg-rose-600' : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-h)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    action: null,
    user: null,
    title: '',
    message: '',
    confirmText: '',
    danger: false,
  });

  useEffect(() => {
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/users?page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const response = await apiClient(url, { admin: true });
      const data = response.data || response;

      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        localStorage.removeItem('circle_admin_token');
        localStorage.removeItem('circle_admin');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAction = async (action, userData) => {
    const confirmConfigs = {
      suspend: {
        title: 'Suspend User',
        message: `Are you sure you want to suspend @${userData.username}? They will not be able to log in or interact with the platform.`,
        confirmText: 'Suspend',
        danger: true,
      },
      unsuspend: {
        title: 'Unsuspend User',
        message: `Are you sure you want to unsuspend @${userData.username}? They will regain access to the platform.`,
        confirmText: 'Unsuspend',
        danger: false,
      },
      verify: {
        title: 'Verify User',
        message: `Are you sure you want to verify @${userData.username}? They will receive a verification badge.`,
        confirmText: 'Verify',
        danger: false,
      },
      unverify: {
        title: 'Remove Verification',
        message: `Are you sure you want to remove verification from @${userData.username}?`,
        confirmText: 'Remove',
        danger: true,
      },
      delete: {
        title: 'Delete User',
        message: `Are you sure you want to permanently delete @${userData.username}? This action cannot be undone. All their posts, comments, and data will be removed.`,
        confirmText: 'Delete',
        danger: true,
      },
    };

    if (action === 'view') {
      router.push(`/admin/users/${userData.id}`);
      return;
    }

    const config = confirmConfigs[action];
    if (!config) return;

    setDialog({
      isOpen: true,
      action,
      user: userData,
      ...config,
    });
  };

  const confirmAction = async () => {
    const { action, user } = dialog;
    setDialog({ ...dialog, isOpen: false });

    try {
      let endpoint = '';
      let method = 'PUT';
      let body = {};

      switch (action) {
        case 'suspend':
          endpoint = `/api/admin/users/${user.id}/suspend`;
          break;
        case 'unsuspend':
          endpoint = `/api/admin/users/${user.id}/unsuspend`;
          break;
        case 'verify':
          endpoint = `/api/admin/users/${user.id}/verify`;
          body = { verified: true };
          break;
        case 'unverify':
          endpoint = `/api/admin/users/${user.id}/verify`;
          body = { verified: false };
          break;
        case 'delete':
          endpoint = `/api/admin/users/${user.id}`;
          method = 'DELETE';
          break;
        default:
          return;
      }

      await apiClient(endpoint, { method, admin: true, body });
      fetchUsers();
    } catch (err) {
      console.error('Action failed:', err);
      alert(`Failed to ${action} user: ${err.message}`);
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loading && users.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Manage Users</h1>
          <p className="text-sm text-[var(--color-txt2)]">{total.toLocaleString()} total users</p>
        </div>
        <button
          onClick={fetchUsers}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition"
        >
          <RefreshCwIcon />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-txt3)]">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, username, or email..."
              className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
          >
            <FilterIcon />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
            <div>
              <label className="block text-xs text-[var(--color-txt2)] mb-1">Status</label>
              <select
                value={search.includes('suspended') ? 'suspended' : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'suspended') {
                    setSearch('suspended');
                  } else {
                    setSearch('');
                  }
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
              >
                <option value="all">All Users</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ─── Desktop Table ─── */}
      <div className="hidden md:block bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Posts</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Followers</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-[var(--color-txt2)]">
                    <div className="flex flex-col items-center gap-2">
                      <EmptyUsersIcon />
                      <p>No users found</p>
                      <p className="text-sm text-[var(--color-txt3)]">Try adjusting your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <DesktopUserRow
                    key={u.id}
                    user={u}
                    onAction={handleAction}
                    currentUserId={user?.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Mobile Cards ─── */}
      <div className="md:hidden bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {users.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--color-txt2)]">
            <div className="flex flex-col items-center gap-2">
              <EmptyUsersIcon />
              <p>No users found</p>
              <p className="text-sm text-[var(--color-txt3)]">Try adjusting your search</p>
            </div>
          </div>
        ) : (
          users.map((u) => (
            <MobileUserCard
              key={u.id}
              user={u}
              onAction={handleAction}
              currentUserId={user?.id}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 mt-4 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]">
          <div className="text-sm text-[var(--color-txt2)]">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (page <= 3) p = i + 1;
              else if (page >= totalPages - 2) p = totalPages - 4 + i;
              else p = page - 2 + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    p === page
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            {totalPages > 5 && page < totalPages - 2 && (
              <>
                <span className="px-2 py-1 text-[var(--color-txt3)]">…</span>
                <button
                  onClick={() => setPage(totalPages)}
                  className="px-3 py-1 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={dialog.isOpen}
        onClose={() => setDialog({ ...dialog, isOpen: false })}
        onConfirm={confirmAction}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        danger={dialog.danger}
      />
    </div>
  );
}