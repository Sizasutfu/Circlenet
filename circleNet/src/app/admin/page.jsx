// src/app/admin/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

// ─── Icons ──────────────────────────────────────────────────────────────
const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const PostsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const CommentsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);

const ReportIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

// ─── Stat Card ──────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color, href, subtitle }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon />
        </div>
        {href && (
          <Link href={href} className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
            <ArrowRightIcon />
          </Link>
        )}
      </div>
      <div className="text-2xl font-bold text-[var(--color-txt)]">{value}</div>
      <div className="text-sm text-[var(--color-txt2)]">{title}</div>
      {subtitle && <div className="text-xs text-[var(--color-txt3)] mt-1">{subtitle}</div>}
    </div>
  );
}

// ─── Quick Action ──────────────────────────────────────────────────────
function QuickAction({ title, description, icon: Icon, onClick, color }) {
  const colors = {
    blue: 'hover:bg-blue-500/10 border-blue-500/20',
    green: 'hover:bg-green-500/10 border-green-500/20',
    purple: 'hover:bg-purple-500/10 border-purple-500/20',
    rose: 'hover:bg-rose-500/10 border-rose-500/20',
    amber: 'hover:bg-amber-500/10 border-amber-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-xl hover:border-[var(--color-accent)] transition text-left w-full ${colors[color]}`}
    >
      <div className={`p-2.5 rounded-xl bg-[var(--color-surface)] text-[var(--color-txt2)]`}>
        <Icon />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[var(--color-txt)]">{title}</div>
        <div className="text-sm text-[var(--color-txt2)]">{description}</div>
      </div>
      <ArrowRightIcon />
    </button>
  );
}

// ─── Recent Activity Item ──────────────────────────────────────────────
function RecentActivity({ type, user, post, time, children }) {
  const typeColors = {
    new_user: 'text-green-500 bg-green-500/10',
    new_post: 'text-blue-500 bg-blue-500/10',
    report: 'text-rose-500 bg-rose-500/10',
    like: 'text-amber-500 bg-amber-500/10',
    comment: 'text-purple-500 bg-purple-500/10',
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--color-border)] last:border-0">
      <div className={`p-1.5 rounded-lg ${typeColors[type] || typeColors.new_post}`}>
        {children}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-txt)]">{user}</div>
        <div className="text-xs text-[var(--color-txt2)] truncate">{post || 'No details'}</div>
      </div>
      <div className="text-xs text-[var(--color-txt3)] flex-shrink-0">{time}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  // ── Redirect if not admin or no admin token ──
  useEffect(() => {
    // Check if admin token exists
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }

    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  // ── Fetch data ──
  useEffect(() => {
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken || user?.role !== 'admin') return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, chartsRes] = await Promise.all([
          apiClient('/api/admin/stats', { admin: true }),
          apiClient('/api/admin/charts', { admin: true }),
        ]);

        setStats(statsRes.data || statsRes);
        setCharts(chartsRes.data || chartsRes);

        // ── Generate recent activity (placeholder) ──
        setRecentActivity([
          { type: 'new_user', user: 'John Doe', post: 'Joined today', time: '2 min ago' },
          { type: 'new_post', user: 'Jane Smith', post: 'Posted "Hello world!"', time: '5 min ago' },
          { type: 'report', user: 'Mike Johnson', post: 'Reported spam post', time: '10 min ago' },
        ]);
      } catch (err) {
        console.error('Failed to load admin data:', err);
        // If token is invalid, redirect to login
        if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
          localStorage.removeItem('circle_admin_token');
          localStorage.removeItem('circle_admin');
          router.push('/admin/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [statsRes, chartsRes] = await Promise.all([
        apiClient('/api/admin/stats', { admin: true }),
        apiClient('/api/admin/charts', { admin: true }),
      ]);
      setStats(statsRes.data || statsRes);
      setCharts(chartsRes.data || chartsRes);
    } catch (err) {
      console.error('Failed to refresh data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Dashboard</h1>
          <p className="text-sm text-[var(--color-txt2)]">Overview of your platform</p>
        </div>
        <button
          onClick={refreshData}
          className="mt-2 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:border-[var(--color-accent)] transition"
          disabled={loading}
        >
          <RefreshIcon />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || '0'}
          icon={UsersIcon}
          color="blue"
          href="/admin/users"
          subtitle={`${stats?.newUsersToday || 0} new today`}
        />
        <StatCard
          title="Total Posts"
          value={stats?.totalPosts?.toLocaleString() || '0'}
          icon={PostsIcon}
          color="green"
          href="/admin/posts"
        />
        <StatCard
          title="Total Comments"
          value={stats?.totalComments?.toLocaleString() || '0'}
          icon={CommentsIcon}
          color="purple"
          href="/admin/comments"
        />
        <StatCard
          title="Pending Reports"
          value={stats?.pendingReports || '0'}
          icon={ReportIcon}
          color="rose"
          href="/admin/reports"
          subtitle="Requires attention"
        />
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--color-txt2)] uppercase tracking-wider mb-4">User Growth</h2>
          {charts?.userGrowth?.length > 0 ? (
            <div className="h-48 flex items-end justify-between gap-1">
              {charts.userGrowth.map((item, index) => {
                const max = Math.max(...charts.userGrowth.map(d => d.count));
                const height = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[var(--color-accent)]/70 rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <span className="text-[8px] text-[var(--color-txt3)]">{new Date(item.date).getDate()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-txt2)]">No data available</div>
          )}
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--color-txt2)] uppercase tracking-wider mb-4">Posts Per Day</h2>
          {charts?.postsPerDay?.length > 0 ? (
            <div className="h-48 flex items-end justify-between gap-1">
              {charts.postsPerDay.map((item, index) => {
                const max = Math.max(...charts.postsPerDay.map(d => d.count));
                const height = max > 0 ? (item.count / max) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[var(--color-green)]/70 rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    <span className="text-[8px] text-[var(--color-txt3)]">{new Date(item.date).getDate()}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-txt2)]">No data available</div>
          )}
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <QuickAction
          title="Manage Users"
          description="View, suspend, or delete users"
          icon={UsersIcon}
          color="blue"
          onClick={() => router.push('/admin/users')}
        />
        <QuickAction
          title="Manage Posts"
          description="Review and moderate content"
          icon={PostsIcon}
          color="green"
          onClick={() => router.push('/admin/posts')}
        />
        <QuickAction
          title="View Reports"
          description="Review reported content"
          icon={ReportIcon}
          color="rose"
          onClick={() => router.push('/admin/reports')}
        />
        <QuickAction
          title="Ads Management"
          description="Create and manage ads"
          icon={TrendingUpIcon}
          color="amber"
          onClick={() => router.push('/admin/ads')}
        />
      </div>

      {/* ─── Recent Activity ─── */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-txt2)] uppercase tracking-wider">Recent Activity</h2>
          <span className="text-xs text-[var(--color-txt3)]">Live</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <RecentActivity key={index} {...activity} />
            ))
          ) : (
            <div className="text-center py-8 text-[var(--color-txt2)]">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}