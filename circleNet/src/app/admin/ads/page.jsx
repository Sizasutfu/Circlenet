'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function AdminAdsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
      const res = await apiClient('/api/ads/list', { admin: true }); // ✅
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

  if (loading) return <div className="p-8 text-center">Loading ads…</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Ad Management</h1>
        <button
          onClick={() => router.push('/admin/ads/new')}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded-full hover:bg-[var(--color-accent-h)] transition"
        >
          + New Ad
        </button>
      </div>

      {ads.length === 0 ? (
        <div className="text-center text-[var(--color-txt2)] py-12">No ads created yet.</div>
      ) : (
        <div className="grid gap-4">
          {ads.map((ad) => (
            <div key={ad.id} className="flex items-center gap-4 border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-card)] hover:shadow-md transition">
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-32 h-20 object-cover rounded"
                onError={(e) => { e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="80" viewBox="0 0 128 80"%3E%3Crect width="128" height="80" fill="%23eee"/%3E%3Ctext x="64" y="44" text-anchor="middle" font-family="sans-serif" font-size="12" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E'; }}
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--color-txt)]">{ad.title}</h3>
                <p className="text-sm text-[var(--color-txt2)]">
                  Placement: <span className="font-mono">{ad.placement}</span>
                  {ad.page_target && ` · Page: ${ad.page_target}`}
                </p>
                <div className="text-xs text-[var(--color-txt3)] mt-1">
                  <span>{ad.clicks} clicks</span> · <span>{ad.impressions} impressions</span>
                  <span className="ml-2">
                    {ad.is_active ? (
                      <span className="text-[var(--color-green)]">● Active</span>
                    ) : (
                      <span className="text-[var(--color-rose)]">● Inactive</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/admin/ads/${ad.id}/edit`)}
                  className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAd(ad.id)}
                  className="px-3 py-1 text-sm border border-[var(--color-rose)] text-[var(--color-rose)] rounded hover:bg-[var(--color-rose-bg)] transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}