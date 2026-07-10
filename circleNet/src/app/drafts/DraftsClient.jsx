// app/drafts/DraftsClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getAllDrafts, deleteDraft } from '@/lib/drafts';
import Link from 'next/link';

function timeAgo(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function DraftsClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    setDrafts(getAllDrafts());
    setLoading(false);
  }, [user, router]);

  const handleDelete = (id) => {
    if (!confirm('Delete this draft?')) return;
    deleteDraft(id);
    setDrafts(getAllDrafts());
  };

  const handleLoad = (id) => {
    router.push(`/compose?draftId=${id}`);
  };

  if (loading) {
    return <div className="p-8 text-center text-[var(--color-txt2)]">Loading drafts...</div>;
  }

  if (drafts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-head font-bold text-[var(--color-txt)]">No Drafts</h1>
        <p className="text-[var(--color-txt2)] mt-2">You have no saved drafts.</p>
        <Link href="/compose" className="mt-4 inline-block px-4 py-2 bg-[var(--color-accent)] text-white rounded-full">
          Create a new post
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-head font-bold text-[var(--color-txt)] mb-6">📝 My Drafts</h1>
      <div className="space-y-3">
        {drafts.map((draft) => {
          const previewText = draft.type === 'post' ? draft.text : draft.title || 'Untitled';
          const typeLabel = draft.type === 'post' ? 'Post' : 'Article';
          const previewImage = draft.type === 'post' ? draft.imagePreview : draft.coverPreview;
          return (
            <div
              key={draft.id}
              className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition"
            >
              {previewImage && (
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-[var(--color-surface)]">
                  <img src={previewImage} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-accent)] bg-[var(--color-accent-bg)] px-2 py-0.5 rounded">
                    {typeLabel}
                  </span>
                  <span className="text-xs text-[var(--color-txt3)]">
                    Updated {timeAgo(draft.updatedAt)}
                  </span>
                </div>
                <div className="text-sm font-semibold text-[var(--color-txt)] truncate">
                  {previewText || 'Empty draft'}
                </div>
                {draft.groupId && (
                  <div className="text-xs text-[var(--color-txt2)]">Group: #{draft.groupId}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoad(draft.id)}
                  className="px-3 py-1 text-xs font-medium bg-[var(--color-accent)] text-white rounded-full hover:bg-[var(--color-accent-h)] transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(draft.id)}
                  className="p-1 text-[var(--color-txt3)] hover:text-[var(--color-rose)] transition"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}