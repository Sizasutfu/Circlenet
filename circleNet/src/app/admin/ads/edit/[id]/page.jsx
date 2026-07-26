'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function EditAdPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [placement, setPlacement] = useState('feed');
  const [pageTarget, setPageTarget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    const fetchAd = async () => {
      try {
        // Fetch all ads and filter (since we don't have a single GET endpoint)
        const res = await apiClient('/api/ads/list', { admin: true });
        const ad = (res.data || []).find(a => a.id === parseInt(id));
        if (!ad) throw new Error('Ad not found');
        setTitle(ad.title);
        setImageUrl(ad.image_url);
        setLinkUrl(ad.link_url);
        setPlacement(ad.placement);
        setPageTarget(ad.page_target || '');
        setStartDate(ad.start_date.slice(0, 16));
        setEndDate(ad.end_date.slice(0, 16));
        setIsActive(ad.is_active === 1);
      } catch (err) {
        setError(err.message || 'Failed to load ad');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAd();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        image_url: imageUrl,
        link_url: linkUrl,
        placement,
        page_target: pageTarget || null,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive ? 1 : 0,
      };
      await apiClient(`/yapi/ads/${id}`, { method: 'PUT', body: payload, admin: true });
      setSuccess(true);
      setTimeout(() => router.push('/admin/ads'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to update ad');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading ad…</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/ads" className="text-[var(--color-txt2)] hover:text-[var(--color-txt)]">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Edit Ad</h1>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-[var(--color-green-bg)] border border-[var(--color-green)] text-[var(--color-green)] rounded-lg">
          Ad updated successfully! Redirecting…
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* same form fields as NewAdPage */}
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Image URL *</label>
          <input
            type="url"
            required
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
          />
          {imageUrl && (
            <div className="mt-2">
              <img src={imageUrl} alt="Preview" className="max-h-32 rounded border border-[var(--color-border)]" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Link URL *</label>
          <input
            type="url"
            required
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Placement *</label>
          <select
            required
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
          >
            <option value="feed">Feed</option>
            <option value="sidebar">Sidebar</option>
            <option value="in-post">Inside Post</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Page Target (optional)</label>
          <input
            type="text"
            value={pageTarget}
            onChange={(e) => setPageTarget(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date *</label>
            <input
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date *</label>
            <input
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            id="isActive"
            className="w-4 h-4"
          />
          <label htmlFor="isActive" className="text-sm">Active</label>
        </div>

        {error && (
          <div className="p-3 bg-[var(--color-rose-bg)] border border-[var(--color-rose)] text-[var(--color-rose)] rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link
            href="/admin/ads"
            className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full hover:bg-[var(--color-surface)] transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}