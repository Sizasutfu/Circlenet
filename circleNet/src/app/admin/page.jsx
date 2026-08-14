// src/app/admin/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';

// ─── Chart.js Imports ──────────────────────────────────────────────────
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart as ReactChart } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ─── Icons ──────────────────────────────────────────────────────────────

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

const RepostsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 014-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 01-4 4H3" />
  </svg>
);

const CommentsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const NewUsersIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

const ReportsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const RefreshIcon = () => (
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

// ─── Stat Card ──────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, color }) {
  const colors = {
    purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-xl ${colors[color]}`}>
          <Icon />
        </div>
      </div>
      <div className="text-2xl font-bold text-[var(--color-txt)]">{value}</div>
      <div className="text-sm text-[var(--color-txt2)]">{title}</div>
    </div>
  );
}

// ─── Chart Component ──────────────────────────────────────────────────

function Chart({ data, color = 'accent', type = 'line' }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[var(--color-txt2)]">
        <div className="text-center">
          <svg className="w-10 h-10 mx-auto mb-2 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No data available</p>
        </div>
      </div>
    );
  }

  const colors = {
    accent: '#6c63ff',
    blue: '#38bdf8',
    green: '#4ade80',
    purple: '#a78bfa',
    rose: '#fb7185',
    amber: '#fbbf24',
  };

  const bgColors = {
    accent: 'rgba(108,99,255,0.12)',
    blue: 'rgba(56,189,248,0.15)',
    green: 'rgba(74,222,128,0.15)',
    purple: 'rgba(167,139,250,0.15)',
    rose: 'rgba(251,113,133,0.15)',
    amber: 'rgba(251,191,36,0.15)',
  };

  const chartColor = colors[color] || colors.accent;
  const chartBg = bgColors[color] || bgColors.accent;

  const chartData = {
    labels: data.map(d => d.label || d.date || ''),
    datasets: [{
      data: data.map(d => d.count || d.value || 0),
      borderColor: chartColor,
      backgroundColor: type === 'bar' ? chartBg : chartBg,
      borderWidth: 2.5,
      pointRadius: type === 'line' ? 3 : 0,
      pointHoverRadius: 5,
      tension: 0.4,
      fill: type === 'line',
      borderRadius: type === 'bar' ? 4 : 0,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { color: 'rgba(42,51,71,0.3)' },
        ticks: { maxTicksLimit: 8, color: '#8892a4' },
      },
      y: {
        grid: { color: 'rgba(42,51,71,0.3)' },
        beginAtZero: true,
        ticks: { precision: 0, color: '#8892a4' },
      },
    },
  };

  return (
    <div className="h-[200px]">
      <ReactChart type={type} data={chartData} options={options} />
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
  const [lastUpdated, setLastUpdated] = useState('Loading…');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Redirect if not admin ──
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

  // ── Fetch data ──
  useEffect(() => {
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken || user?.role !== 'admin') return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, chartsRes] = await Promise.all([
        apiClient('/api/admin/stats', { admin: true }),
        apiClient('/api/admin/charts', { admin: true }),
      ]);

      setStats(statsRes.data || statsRes);
      setCharts(chartsRes.data || chartsRes);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load admin data:', err);
      if (err.message?.includes('expired') || err.message?.includes('Invalid')) {
        localStorage.removeItem('circle_admin_token');
        localStorage.removeItem('circle_admin');
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  // Format chart data for Chart component
  const formatChartData = (rows, days = 30) => {
    if (!rows || rows.length === 0) return [];
    
    const map = {};
    rows.forEach(r => {
      const date = r.date?.slice(0, 10) || r.date;
      map[date] = r.count || r.value || 0;
    });
    
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      result.push({ label, count: map[key] || 0 });
    }
    return result;
  };

  const userGrowthData = formatChartData(charts?.userGrowth);
  const postsPerDayData = formatChartData(charts?.postsPerDay);

  if (loading && !stats) {
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
              <span className="font-semibold text-[var(--color-txt)]">Dashboard</span>
              <span className="text-[var(--color-txt2)] ml-1">Overview</span>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-lg text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-txt)]">Dashboard</h1>
              <p className="text-sm text-[var(--color-txt2)]">Last updated {lastUpdated}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatCard title="Total Users" value={stats?.totalUsers?.toLocaleString() || '0'} icon={UsersIcon} color="purple" />
            <StatCard title="Total Posts" value={stats?.totalPosts?.toLocaleString() || '0'} icon={PostsIcon} color="blue" />
            <StatCard title="Total Reposts" value={stats?.totalReposts?.toLocaleString() || '0'} icon={RepostsIcon} color="green" />
            <StatCard title="Total Comments" value={stats?.totalComments?.toLocaleString() || '0'} icon={CommentsIcon} color="amber" />
            <StatCard title="New Users Today" value={stats?.newUsersToday?.toLocaleString() || '0'} icon={NewUsersIcon} color="green" />
            <StatCard title="Pending Reports" value={stats?.pendingReports?.toLocaleString() || '0'} icon={ReportsIcon} color="rose" />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-txt2)] mb-4">
                <UsersIcon />
                User Growth (Last 30 Days)
              </div>
              <Chart data={userGrowthData} color="accent" type="line" />
            </div>

            <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-txt2)] mb-4">
                <PostsIcon />
                Posts Per Day (Last 30 Days)
              </div>
              <Chart data={postsPerDayData} color="blue" type="bar" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}