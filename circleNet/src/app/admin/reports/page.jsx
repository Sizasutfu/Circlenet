// src/app/admin/reports/page.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';

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

const RefreshCwIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
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

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="22 3 2 3 10 13 10 21 14 18 14 13 22 3" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const EmptyReportsIcon = () => (
  <svg className="w-12 h-12 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const VideoIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

// ─── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const variants = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    resolved: 'bg-green-500/10 text-green-500 border-green-500/20',
    ignored: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };

  const labels = {
    pending: 'Pending',
    resolved: 'Resolved',
    ignored: 'Ignored',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${variants[status] || variants.pending}`}>
      {labels[status] || status}
    </span>
  );
}

// ─── Media Badge ──────────────────────────────────────────────────────

function MediaBadge({ type }) {
  if (!type) return null;
  
  const variants = {
    image: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    video: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const icons = {
    image: <ImageIcon />,
    video: <VideoIcon />,
  };

  const labels = {
    image: 'Image',
    video: 'Video',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${variants[type] || ''}`}>
      {icons[type]}
      {labels[type]}
    </span>
  );
}

// ─── Mobile Report Card ─────────────────────────────────────────────

function MobileReportCard({ report, onAction }) {
  const truncateText = (text, max = 60) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const mediaType = report.postImage ? 'image' : report.postVideo ? 'video' : null;

  return (
    <div className="border-b border-[var(--color-border)] p-4 hover:bg-[var(--color-surface)] transition">
      <div className="flex flex-col gap-2">
        {/* Post content */}
        <div className="text-sm text-[var(--color-txt)] line-clamp-2">
          {truncateText(report.postText, 80)}
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {mediaType && <MediaBadge type={mediaType} />}
          <span className="text-xs text-[var(--color-txt3)]">
            {new Date(report.reportedAt).toLocaleDateString()}
          </span>
        </div>
        
        {/* Author */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-txt2)]">Author:</span>
          <Link 
            href={`/profile/${report.authorUsername || report.authorId}`}
            className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
            onClick={(e) => e.stopPropagation()}
          >
            {report.authorName}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{report.authorUsername || 'unknown'}</span>
        </div>
        
        {/* Reporter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-txt2)]">Reported by:</span>
          <Link 
            href={`/profile/${report.reporterUsername || report.reporterId}`}
            className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
            onClick={(e) => e.stopPropagation()}
          >
            {report.reporterName}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{report.reporterUsername || 'unknown'}</span>
        </div>
        
        {/* Reason */}
        <div>
          <span className="text-xs text-[var(--color-txt2)]">Reason:</span>
          <div className="text-sm text-[var(--color-txt)] mt-0.5">
            {report.reason || 'No reason provided'}
          </div>
        </div>
        
        {/* Status & Actions */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)]">
          <StatusBadge status={report.status} />
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAction('view_post', report)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
              title="View Post"
            >
              <EyeIcon />
            </button>
            <button
              onClick={() => onAction('view_author', report)}
              className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
              title="View Author"
            >
              <UserIcon />
            </button>
            {report.status === 'pending' && (
              <>
                <button
                  onClick={() => onAction('resolve', report)}
                  className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500 hover:text-green-600 transition"
                  title="Resolve Report"
                >
                  <CheckIcon />
                </button>
                <button
                  onClick={() => onAction('ignore', report)}
                  className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-500 hover:text-gray-600 transition"
                  title="Ignore Report"
                >
                  <XIcon />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Report Row ─────────────────────────────────────────────

function DesktopReportRow({ report, onAction }) {
  const truncateText = (text, max = 40) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '…' : text;
  };

  const mediaType = report.postImage ? 'image' : report.postVideo ? 'video' : null;

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition">
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-[var(--color-txt)] line-clamp-2">
            {truncateText(report.postText, 60)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {mediaType && <MediaBadge type={mediaType} />}
            <span className="text-xs text-[var(--color-txt3)]">
              {new Date(report.reportedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link 
            href={`/profile/${report.authorUsername || report.authorId}`}
            className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
            onClick={(e) => e.stopPropagation()}
          >
            {report.authorName}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{report.authorUsername || 'unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Link 
            href={`/profile/${report.reporterUsername || report.reporterId}`}
            className="text-sm font-medium text-[var(--color-txt)] hover:text-[var(--color-accent)] transition"
            onClick={(e) => e.stopPropagation()}
          >
            {report.reporterName}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{report.reporterUsername || 'unknown'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="max-w-[200px]">
          <div className="text-sm text-[var(--color-txt)] font-medium">Reason</div>
          <div className="text-xs text-[var(--color-txt2)] line-clamp-2">
            {report.reason || 'No reason provided'}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={report.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onAction('view_post', report)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
            title="View Post"
          >
            <EyeIcon />
          </button>
          <button
            onClick={() => onAction('view_author', report)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-txt2)] hover:text-[var(--color-txt)] transition"
            title="View Author"
          >
            <UserIcon />
          </button>
          {report.status === 'pending' && (
            <>
              <button
                onClick={() => onAction('resolve', report)}
                className="p-1.5 rounded-lg hover:bg-green-500/10 text-green-500 hover:text-green-600 transition"
                title="Resolve Report"
              >
                <CheckIcon />
              </button>
              <button
                onClick={() => onAction('ignore', report)}
                className="p-1.5 rounded-lg hover:bg-gray-500/10 text-gray-500 hover:text-gray-600 transition"
                title="Ignore Report"
              >
                <XIcon />
              </button>
            </>
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

export default function AdminReportsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [dialog, setDialog] = useState({
    isOpen: false,
    action: null,
    report: null,
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

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/reports?status=${statusFilter}&page=${page}`;

      const response = await apiClient(url, { admin: true });
      const data = response.data || response;

      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        localStorage.removeItem('circle_admin_token');
        localStorage.removeItem('circle_admin');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, router]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (action, reportData) => {
    if (action === 'view_post') {
      router.push(`/post/${reportData.postId}`);
      return;
    }

    if (action === 'view_author') {
      router.push(`/admin/users/${reportData.authorId}`);
      return;
    }

    if (action === 'resolve') {
      setDialog({
        isOpen: true,
        action,
        report: reportData,
        title: 'Resolve Report',
        message: `Are you sure you want to resolve this report? The post will be removed and the reporter will be notified.`,
        confirmText: 'Resolve',
        danger: false,
      });
      return;
    }

    if (action === 'ignore') {
      setDialog({
        isOpen: true,
        action,
        report: reportData,
        title: 'Ignore Report',
        message: `Are you sure you want to ignore this report? No action will be taken and the reporter will be notified.`,
        confirmText: 'Ignore',
        danger: false,
      });
      return;
    }
  };

  const confirmAction = async () => {
    const { action, report } = dialog;
    setDialog({ ...dialog, isOpen: false });

    try {
      let endpoint = '';
      if (action === 'resolve') {
        endpoint = `/api/admin/reports/${report.id}/resolve`;
      } else if (action === 'ignore') {
        endpoint = `/api/admin/reports/${report.id}/ignore`;
      }

      if (endpoint) {
        await apiClient(endpoint, { method: 'PUT', admin: true });
        fetchReports();
      }
    } catch (err) {
      console.error(`Failed to ${action} report:`, err);
      alert(`Failed to ${action} report: ${err.message}`);
    }
  };

  const totalPages = Math.ceil(total / 20);

  if (loading && reports.length === 0) {
    return (
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 ml-0 md:ml-[260px] flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ─── Main Content ─── */}
      <div className="flex-1 ml-0 md:ml-[260px]">
        {/* ─── Topbar ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </button>
            <div>
              <span className="font-semibold text-[var(--color-txt)]">Reports</span>
              <span className="text-[var(--color-txt2)] ml-1">Moderation</span>
            </div>
          </div>
          <button
            onClick={fetchReports}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
            disabled={loading}
          >
            <RefreshCwIcon />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Reports</h1>
              <p className="text-sm text-[var(--color-txt2)]">
                {total.toLocaleString()} {statusFilter === 'pending' ? 'pending' : 'total'} reports
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-txt2)]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
              >
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          </div>

          {/* ─── Desktop Table ─── */}
          <div className="hidden md:block bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Reported Post</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Author</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Reported By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-12 text-center text-[var(--color-txt2)]">
                        <div className="flex flex-col items-center gap-2">
                          <EmptyReportsIcon />
                          <p>No {statusFilter} reports found</p>
                          <p className="text-sm text-[var(--color-txt3)]">
                            {statusFilter === 'pending' 
                              ? 'All clear! No pending reports to review.' 
                              : 'No reports with this status'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    reports.map((r) => (
                      <DesktopReportRow
                        key={r.id}
                        report={r}
                        onAction={handleAction}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Mobile Cards ─── */}
          <div className="md:hidden bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {reports.length === 0 ? (
              <div className="px-4 py-12 text-center text-[var(--color-txt2)]">
                <div className="flex flex-col items-center gap-2">
                  <EmptyReportsIcon />
                  <p>No {statusFilter} reports found</p>
                  <p className="text-sm text-[var(--color-txt3)]">
                    {statusFilter === 'pending' 
                      ? 'All clear! No pending reports to review.' 
                      : 'No reports with this status'}
                  </p>
                </div>
              </div>
            ) : (
              reports.map((r) => (
                <MobileReportCard
                  key={r.id}
                  report={r}
                  onAction={handleAction}
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
      </div>
    </div>
  );
}