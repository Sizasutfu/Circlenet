// src/components/compose/ComposeModal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useCompose } from '@/contexts/ComposeContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

export default function ComposeModal() {
  const { isOpen, closeCompose, initialText, groupId } = useCompose();
  const { user } = useAuth();
  const router = useRouter();

  const [text, setText] = useState(initialText || '');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Reset state when modal opens with new initial text
  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setImage(null);
      setImagePreview(null);
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialText]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!user) {
      setError('Please log in to post.');
      return;
    }
    if (!text.trim() && !image) {
      setError('Please write something or add an image.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('text', text.trim());
      if (image) formData.append('image', image);
      if (groupId) formData.append('groupId', String(groupId));

      // Use apiClient – it adds Authorization and X-User-Id automatically
      const data = await apiClient('/api/posts', {
        method: 'POST',
        body: formData,
      });

      const newPost = data.data || data;

      // Optimistically add to feed – we'll rely on the feed page to refresh
      closeCompose();
      // If we have a groupId, navigate to that group's page
      if (groupId) {
        router.push(`/groups/${groupId}`);
      } else {
        router.push('/feed');
      }
      // Force a hard refresh to show new post (or use SWR/invalidation)
      router.refresh();
    } catch (err) {
      console.error('[Compose] Error:', err);
      setError(err.message || 'Failed to create post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeCompose}>
      <div
        className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="font-head font-bold text-[var(--color-txt)]">Create a post</h3>
          <button onClick={closeCompose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User avatar */}
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden"
              style={{
                background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
              }}
            >
              {user?.picture ? (
                <img src={resolveMediaUrl(user.picture)} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-txt)]">{user?.name || 'You'}</p>
              {groupId && <p className="text-xs text-[var(--color-txt2)]">Posting in group</p>}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-transparent border-none outline-none resize-none text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] text-sm min-h-[100px]"
            rows={4}
          />

          {/* Image preview */}
          {imagePreview && (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="max-h-48 rounded-lg border border-[var(--color-border)]" />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="border-t border-[var(--color-border)] p-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
              title="Attach image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageSelect}
              />
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (!text.trim() && !image)}
            className="px-5 py-2 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {isSubmitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function stringToColor(str) {
  if (!str) return '#888';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}