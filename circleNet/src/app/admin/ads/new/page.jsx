'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function NewAdPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [placement, setPlacement] = useState('feed');
  const [pageTarget, setPageTarget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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
      await apiClient('/api/ads', { method: 'POST', body: payload, admin: true });
      setSuccess(true);
      setTimeout(() => router.push('/admin/ads'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to create ad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/ads" className="text-[var(--color-txt2)] hover:text-[var(--color-txt)]">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Create New Ad</h1>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-[var(--color-green-bg)] border border-[var(--color-green)] text-[var(--color-green)] rounded-lg">
          Ad created successfully! Redirecting…
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="https://example.com/banner.png"
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
            placeholder="https://example.com/destination"
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
            <option value="feed">Feed (in‑between posts)</option>
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
            placeholder="profile, explore, etc. (leave blank for all)"
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
          <label htmlFor="isActive" className="text-sm">Active (visible immediately)</label>
        </div>

        {error && (
          <div className="p-3 bg-[var(--color-rose-bg)] border border-[var(--color-rose)] text-[var(--color-rose)] rounded-lg">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Ad'}
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