// src/app/compose/ComposePage.jsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import PhotoEditor from '@/components/PhotoEditor';

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
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

// ── Helper: dataURL to File ──
function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

// ── Helper: get draft key ──
function getDraftKey(userId, mode, groupId) {
  return `compose_draft_${userId}_${mode}${groupId ? '_group_' + groupId : ''}`;
}

export default function ComposePage({ groupId = null }) {
  const { user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState('post');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Post state
  const [postText, setPostText] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);

  // Photo editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorImageSrc, setEditorImageSrc] = useState(null);

  // Article state
  const [articleTitle, setArticleTitle] = useState('');
  const [articleExcerpt, setArticleExcerpt] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleTags, setArticleTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [articlePublished, setArticlePublished] = useState(false);
  const [articleCover, setArticleCover] = useState(null);
  const [articleCoverPreview, setArticleCoverPreview] = useState(null);

  const textareaRef = useRef(null);
  const saveTimerRef = useRef(null);
  const draftKey = user ? getDraftKey(user.id, mode, groupId) : null;

  // ── Load draft from localStorage on mount ──
  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored);
        if (mode === 'post') {
          if (draft.postText) setPostText(draft.postText);
          if (draft.postImage) {
            // Restore image from data URL
            try {
              const file = dataURLtoFile(draft.postImage, 'draft-image.png');
              setPostImage(file);
              setPostImagePreview(draft.postImage);
            } catch (_) {
              // If invalid, ignore
            }
          }
        } else {
          if (draft.articleTitle) setArticleTitle(draft.articleTitle);
          if (draft.articleExcerpt) setArticleExcerpt(draft.articleExcerpt);
          if (draft.articleContent) setArticleContent(draft.articleContent);
          if (draft.articleTags) setArticleTags(draft.articleTags);
          if (draft.articlePublished !== undefined) setArticlePublished(draft.articlePublished);
          if (draft.articleCover) {
            try {
              const file = dataURLtoFile(draft.articleCover, 'draft-cover.png');
              setArticleCover(file);
              setArticleCoverPreview(draft.articleCover);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }, [user, draftKey, mode]);

  // ── Save draft with debounce ──
  const saveDraft = useCallback(() => {
    if (!user) return;
    const draft = {};
    if (mode === 'post') {
      draft.postText = postText;
      if (postImagePreview) draft.postImage = postImagePreview;
    } else {
      draft.articleTitle = articleTitle;
      draft.articleExcerpt = articleExcerpt;
      draft.articleContent = articleContent;
      draft.articleTags = articleTags;
      draft.articlePublished = articlePublished;
      if (articleCoverPreview) draft.articleCover = articleCoverPreview;
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (_) {}
  }, [user, draftKey, mode, postText, postImagePreview, articleTitle, articleExcerpt, articleContent, articleTags, articlePublished, articleCoverPreview]);

  useEffect(() => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [saveDraft]);

  // ── Clear draft on submit ──
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch (_) {}
  };

  // ── Tag handlers ──
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    if (articleTags.includes(tag)) return;
    setArticleTags([...articleTags, tag]);
    setTagInput('');
  };

  const removeTag = (tag) => {
    setArticleTags(articleTags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  // ── Post image ──
  const handlePostImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setPostImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPostImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditor = () => {
    if (!postImagePreview) return;
    setEditorImageSrc(postImagePreview);
    setShowEditor(true);
  };

  const handleEditorSave = (editedFile) => {
    setPostImage(editedFile);
    const reader = new FileReader();
    reader.onload = (ev) => setPostImagePreview(ev.target.result);
    reader.readAsDataURL(editedFile);
    setShowEditor(false);
    setEditorImageSrc(null);
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditorImageSrc(null);
  };

  const removePostImage = () => {
    setPostImage(null);
    setPostImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Article cover ──
  const handleArticleCoverSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setArticleCover(file);
    const reader = new FileReader();
    reader.onload = (ev) => setArticleCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeArticleCover = () => {
    setArticleCover(null);
    setArticleCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!user) {
      setError('Please log in to post.');
      return;
    }

    if (mode === 'post') {
      if (!postText.trim() && !postImage) {
        setError('Please write something or add an image.');
        return;
      }
      setIsSubmitting(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('text', postText.trim());
        if (postImage) formData.append('image', postImage);
        if (groupId) formData.append('groupId', String(groupId));

        await apiClient('/api/posts', {
          method: 'POST',
          body: formData,
        });

        clearDraft();
        if (groupId) {
          router.push(`/groups/${groupId}`);
        } else {
          router.push('/feed');
        }
        router.refresh();
      } catch (err) {
        setError(err.message || 'Failed to create post.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Article mode
    if (!articleTitle.trim() || !articleContent.trim()) {
      setError('Title and content are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', articleTitle.trim());
      formData.append('content', articleContent.trim());
      if (articleExcerpt.trim()) formData.append('excerpt', articleExcerpt.trim());
      formData.append('published', articlePublished ? 'true' : 'false');
      formData.append('tags', JSON.stringify(articleTags));
      if (articleCover) formData.append('image', articleCover);

      await apiClient('/api/articles', {
        method: 'POST',
        body: formData,
      });

      clearDraft();
      router.push('/articles');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Failed to create article.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Photo Editor Modal */}
      {showEditor && (
        <PhotoEditor
          image={editorImageSrc}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-[var(--color-txt2)] hover:text-[var(--color-txt)] rounded-lg hover:bg-[var(--color-surface)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">
          {mode === 'post' ? 'Create a post' : 'Write an article'}
        </h1>
        {groupId && (
          <span className="ml-2 text-sm text-[var(--color-txt2)] bg-[var(--color-surface)] px-3 py-1 rounded-full">
            in group
          </span>
        )}
        <span className="ml-auto text-xs text-[var(--color-txt3)]">💾 Draft saved</span>
      </div>

      {/* Mode toggle */}
      <div className="flex border border-[var(--color-border)] rounded-xl overflow-hidden mb-6 bg-[var(--color-surface)] p-1">
        <button
          onClick={() => setMode('post')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            mode === 'post'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Post
        </button>
        <button
          onClick={() => setMode('article')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${
            mode === 'article'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
          }`}
        >
          Article
        </button>
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 mb-4">
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
          {mode === 'article' && <p className="text-xs text-[var(--color-txt2)]">Article will appear in Articles</p>}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {mode === 'post' && (
          <>
            <textarea
              ref={textareaRef}
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none resize-none min-h-[120px]"
              rows={4}
            />
            {postImagePreview && (
              <div className="relative inline-block group">
                <img src={postImagePreview} alt="Preview" className="max-h-48 rounded-lg border border-[var(--color-border)]" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-lg">
                  <button
                    onClick={openEditor}
                    className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-md text-xs font-semibold hover:bg-[var(--color-accent-h)] transition"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={removePostImage}
                    className="px-3 py-1.5 bg-[var(--color-rose)] text-white rounded-md text-xs font-semibold hover:bg-[var(--color-rose)]/80 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition text-sm flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                Attach image
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePostImageSelect}
                />
              </button>
              {postImagePreview && (
                <span className="text-xs text-[var(--color-txt2)]">
                  (Hover image to edit/remove)
                </span>
              )}
            </div>
          </>
        )}

        {mode === 'article' && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Title *</label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="Article title"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Excerpt (summary)</label>
              <input
                type="text"
                value={articleExcerpt}
                onChange={(e) => setArticleExcerpt(e.target.value)}
                placeholder="Short description"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Content *</label>
              <textarea
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                placeholder="Write your article in plain text or HTML"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none resize-y min-h-[200px]"
                rows={8}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Tags</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="e.g. tech, design"
                  className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none"
                />
                <button
                  onClick={addTag}
                  className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-accent-h)] transition"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {articleTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full px-3 py-1 text-xs">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-[var(--color-rose)] transition">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Cover Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleArticleCoverSelect}
                className="w-full text-sm text-[var(--color-txt2)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-accent)] file:text-white hover:file:bg-[var(--color-accent-h)]"
              />
              {articleCoverPreview && (
                <div className="relative mt-2 inline-block">
                  <img src={articleCoverPreview} alt="Cover preview" className="max-h-32 rounded-lg border border-[var(--color-border)]" />
                  <button
                    onClick={removeArticleCover}
                    className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-txt2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={articlePublished}
                  onChange={(e) => setArticlePublished(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                Publish now
              </label>
              <span className="text-xs text-[var(--color-txt3)]">(Unchecked = save as draft)</span>
            </div>
          </>
        )}

        {error && (
          <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : mode === 'post' ? 'Post' : 'Save Article'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full text-sm font-medium hover:bg-[var(--color-surface)] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}