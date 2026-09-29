'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';

// ─── Icons ────────────────────────────────────────────────────────────

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

const RefreshCwIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
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

const ShieldCheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="w-12 h-12 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ─── Category labels ─────────────────────────────────────────────────

const CATEGORY_LABELS = {
  creator:    'Creator',
  journalist: 'Journalist',
  business:   'Business',
  sports:     'Sports',
  music:      'Music',
  actor:      'Actor',
  government: 'Government',
  other:      'Other',
};

const STATUS_TABS = [
  { id: 'pending',  label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

// ─── Status badge ────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    pending:  'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-green-500/10 text-green-500 border-green-500/20',
    rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  const labels = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────

function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false, extra }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-head font-bold text-[var(--color-txt)]">{title}</h3>
        <p className="text-sm text-[var(--color-txt2)] mt-2">{message}</p>
        {extra}
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

// ─── Detail modal ─────────────────────────────────────────────────────

function RequestDetailModal({ request, onClose, onApprove, onReject, actionLoading }) {
  const [note, setNote] = useState('');

  if (!request) return null;

  const submitted = new Date(request.createdAt).toLocaleString();
  const links = request.links
    ? String(request.links).split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  const isPending = request.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3 min-w-0">
            {request.picture ? (
              <img src={request.picture} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent)] flex items-center justify-center font-medium flex-shrink-0">
                {(request.userName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-txt)] truncate">{request.userName}</div>
              <Link
                href={`/profile/${request.username}`}
                target="_blank"
                className="text-sm text-[var(--color-txt2)] hover:text-[var(--color-accent)] flex items-center gap-1"
              >
                @{request.username}
                <ExternalLinkIcon />
              </Link>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex items-center gap-3 text-sm">
            <StatusBadge status={request.status} />
            <span className="text-[var(--color-txt3)]">Submitted {submitted}</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-1">Full name</div>
            <div className="text-[var(--color-txt)]">{request.fullName}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-1">Category</div>
            <div className="text-[var(--color-txt)]">
              {CATEGORY_LABELS[request.category] || request.category}
            </div>
          </div>

          {request.email && (
            <div>
              <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-1">Contact email</div>
              <div className="text-[var(--color-txt)]">{request.email}</div>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-1">Reason</div>
            <p className="text-[var(--color-txt)] text-sm whitespace-pre-wrap leading-relaxed">
              {request.reason}
            </p>
          </div>

          {links.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-2">Links</div>
              <ul className="space-y-1.5">
                {links.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.startsWith('http') ? link : `https://${link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--color-accent)] hover:underline break-all"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {request.adminNote && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
              <div className="text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-1">
                Previous admin note
              </div>
              <p className="text-sm text-[var(--color-txt)]">{request.adminNote}</p>
            </div>
          )}

          {isPending && (
            <div>
              <label className="block text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wide mb-2">
                Note (optional — shown to the user)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Add a note explaining your decision…"
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {isPending && (
          <div className="flex gap-3 p-5 border-t border-[var(--color-border)]">
            <button
              onClick={() => onReject(request.id, note)}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-60"
            >
              <XIcon />
              Reject
            </button>
            <button
              onClick={() => onApprove(request.id, note)}
              disabled={actionLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-green-500 hover:bg-green-600 transition disabled:opacity-60"
            >
              <CheckIcon />
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function AdminVerificationRequestsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('pending');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Admin auth guard — same pattern as users page
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/admin/verification-requests?status=${status}&page=${page}`;
      const res = await apiClient(url, { admin: true });
      const data = res.data || res;
      setRequests(data.requests || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch verification requests:', err);
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        localStorage.removeItem('circle_admin_token');
        localStorage.removeItem('circle_admin');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [status, page, router]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (id, note) => {
    setActionLoading(true);
    try {
      await apiClient(`/api/admin/verification-requests/${id}/approve`, {
        method: 'PUT',
        admin: true,
        body: { note },
      });
      setSelected(null);
      await fetchRequests();
    } catch (err) {
      console.error('Approve failed:', err);
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id, note) => {
    setActionLoading(true);
    try {
      await apiClient(`/api/admin/verification-requests/${id}/reject`, {
        method: 'PUT',
        admin: true,
        body: { note },
      });
      setSelected(null);
      await fetchRequests();
    } catch (err) {
      console.error('Reject failed:', err);
      alert(`Failed to reject: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 ml-0 md:ml-[260px]">
        {/* Topbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </button>
            <div>
              <span className="font-semibold text-[var(--color-txt)]">Verification</span>
              <span className="text-[var(--color-txt2)] ml-1">Requests</span>
            </div>
          </div>
          <button
            onClick={fetchRequests}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
            disabled={loading}
          >
            <RefreshCwIcon />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">
              Verification Requests
            </h1>
            <p className="text-sm text-[var(--color-txt2)]">
              {total.toLocaleString()} {status}
            </p>
          </div>

          {/* Status tabs */}
          <div className="flex gap-2 mb-6">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatus(tab.id);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  status === tab.id
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] border border-[var(--color-border)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {loading && requests.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--color-txt2)]">
                <EmptyIcon />
                <p className="mt-3">No {status} requests</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {requests.map((r) => {
                  const submitted = new Date(r.createdAt).toLocaleDateString();
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className="w-full text-left flex items-center gap-3 p-4 hover:bg-[var(--color-surface)] transition"
                    >
                      {r.picture ? (
                        <img src={r.picture} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[var(--color-accent-bg)] text-[var(--color-accent)] flex items-center justify-center font-medium flex-shrink-0">
                          {(r.userName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--color-txt)] truncate">
                            {r.userName}
                          </span>
                          <span className="text-sm text-[var(--color-txt2)]">@{r.username}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="text-sm text-[var(--color-txt2)] truncate mt-0.5">
                          {CATEGORY_LABELS[r.category] || r.category} · {r.fullName}
                        </div>
                        <div className="text-xs text-[var(--color-txt3)] mt-1 line-clamp-1">
                          {r.reason}
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-xs text-[var(--color-txt3)] hidden sm:flex items-center gap-1">
                        <ClockIcon />
                        {submitted}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon />
                </button>
                <div className="px-3 py-1 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] text-sm text-[var(--color-txt)]">
                  {page} / {totalPages}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <RequestDetailModal
        request={selected}
        onClose={() => setSelected(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        actionLoading={actionLoading}
      />
    </div>
  );
}