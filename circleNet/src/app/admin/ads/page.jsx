// src/app/admin/ads/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';

// ─── Icons ──────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

// ─── No Ads Icon ─────────────────────────────────────────────────────

const EmptyAdsIcon = () => (
  <svg className="w-16 h-16 text-[var(--color-txt3)] mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    <path d="M12 12v9" />
  </svg>
);

// ─── Main Component ────────────────────────────────────────────────────

export default function AdminAdsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient('/api/ads/list', { admin: true });
      setAds(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load ads');
    } finally {
      setLoading(false);
    }
  };

  const deleteAd = async (id) => {
    if (!confirm('Delete this ad?')) return;
    try {
      await apiClient(`/api/ads/${id}`, { method: 'DELETE', admin: true });
      setAds(ads.filter(ad => ad.id !== id));
    } catch (err) {
      alert('Failed to delete ad');
    }
  };

  if (loading) {
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
              <span className="font-semibold text-[var(--color-txt)]">Ads</span>
              <span className="text-[var(--color-txt2)] ml-1">Management</span>
            </div>
          </div>
          <button
            onClick={fetchAds}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Ad Management</h1>
              <p className="text-sm text-[var(--color-txt2)]">{ads.length} ads total</p>
            </div>
            <button
              onClick={() => router.push('/admin/ads/new')}
              className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-accent-h)] transition"
            >
              <PlusIcon />
              New Ad
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl p-4 mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Ads Grid */}
          {ads.length === 0 ? (
            <div className="text-center py-16 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl">
              <EmptyAdsIcon />
              <p className="text-[var(--color-txt2)] mt-4">No ads created yet.</p>
              <p className="text-sm text-[var(--color-txt3)]">Click "New Ad" to create your first ad</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {ads.map((ad) => (
                <div 
                  key={ad.id} 
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-card)] hover:shadow-md transition"
                >
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-full sm:w-32 h-20 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { 
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="80" viewBox="0 0 128 80"%3E%3Crect width="128" height="80" fill="%23eee"/%3E%3Ctext x="64" y="44" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; 
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--color-txt)]">{ad.title}</h3>
                    <p className="text-sm text-[var(--color-txt2)]">
                      Placement: <span className="font-mono bg-[var(--color-surface)] px-1.5 py-0.5 rounded">{ad.placement}</span>
                      {ad.page_target && (
                        <> · Page: <span className="font-mono bg-[var(--color-surface)] px-1.5 py-0.5 rounded">{ad.page_target}</span></>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-txt3)] mt-1">
                      <span>{ad.clicks || 0} clicks</span>
                      <span>· {ad.impressions || 0} impressions</span>
                      <span className={`inline-flex items-center gap-1 ${ad.is_active ? 'text-green-500' : 'text-rose-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {ad.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {ad.start_date && (
                        <span>· {new Date(ad.start_date).toLocaleDateString()} - {new Date(ad.end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => router.push(`/admin/ads/${ad.id}/edit`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] transition text-[var(--color-txt2)] hover:text-[var(--color-txt)]"
                    >
                      <EditIcon />
                      Edit
                    </button>
                    <button
                      onClick={() => deleteAd(ad.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[var(--color-rose)]/30 text-[var(--color-rose)] rounded-lg hover:bg-[var(--color-rose-bg)] transition"
                    >
                      <TrashIcon />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}