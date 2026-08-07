// src/components/compose/ComposeModal.jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useCompose } from '@/contexts/ComposeContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import { extractMentions } from '@/lib/formatText'; // ✅ Import mention extractor

// ── Mention Autocomplete Component ──
function MentionAutocomplete({ searchTerm, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 1) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('circle_token') || 
                     JSON.parse(localStorage.getItem('circle_user') || '{}')?.token;
        const userId = JSON.parse(localStorage.getItem('circle_user') || '{}')?.id;
        
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/users?search=${encodeURIComponent(searchTerm)}&limit=5`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-User-Id': String(userId),
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data?.users || []);
        }
      } catch (err) {
        console.error('Mention search error:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 200);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  if (!suggestions.length || loading) return null;

  return (
    <div className="absolute z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden min-w-[200px] max-h-60 overflow-y-auto" style={{ bottom: '100%', left: 0, marginBottom: '4px' }}>
      {suggestions.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.username)}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-surface)] transition"
        >
          {user.picture ? (
            <img 
              src={resolveMediaUrl(user.picture)} 
              alt={user.name} 
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <AvatarPlaceholder size="w-6 h-6" />
          )}
          <div>
            <p className="text-sm font-medium text-[var(--color-txt)]">{user.name}</p>
            <p className="text-xs text-[var(--color-txt2)]">@{user.username}</p>
          </div>
          {user.verified && (
            <svg className="w-4 h-4 text-[var(--color-accent)] ml-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

export default function ComposeModal() {
  const { isOpen, closeCompose, initialText, groupId } = useCompose();
  const { user } = useAuth();
  const router = useRouter();

  // ── Common state ──
  const [mode, setMode] = useState('post');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ── Post state ──
  const [postText, setPostText] = useState(initialText || '');
  const [postImage, setPostImage] = useState(null);
  const [postImagePreview, setPostImagePreview] = useState(null);

  // ── Mention state ──
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);

  // ── Article state ──
  const [articleTitle, setArticleTitle] = useState('');
  const [articleExcerpt, setArticleExcerpt] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleTags, setArticleTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [articlePublished, setArticlePublished] = useState(false);
  const [articleCover, setArticleCover] = useState(null);
  const [articleCoverPreview, setArticleCoverPreview] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsSubmitting(false);
      setPostText(initialText || '');
      setPostImage(null);
      setPostImagePreview(null);
      setArticleTitle('');
      setArticleExcerpt('');
      setArticleContent('');
      setArticleTags([]);
      setTagInput('');
      setArticlePublished(false);
      setArticleCover(null);
      setArticleCoverPreview(null);
      setShowMentions(false);
      setMentionSearch('');
      setMode(groupId ? 'post' : 'post');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, initialText, groupId]);

  // ── Mention detection ──
  const handleTextChange = (e) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    setPostText(newText);

    const textBeforeCursor = newText.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1 && lastAtIndex < cursor) {
      const searchTerm = textBeforeCursor.slice(lastAtIndex + 1);
      if (!searchTerm.includes(' ') && searchTerm.length > 0) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionSearch('');
  };

  const handleMentionSelect = (username) => {
    const cursor = textareaRef.current?.selectionStart || postText.length;
    const textBeforeCursor = postText.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const before = postText.slice(0, lastAtIndex);
      const after = postText.slice(cursor);
      const newText = `${before}@${username} ${after}`;
      setPostText(newText);
      
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursor = before.length + username.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    }
    
    setShowMentions(false);
    setMentionSearch('');
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

  // ── Image handlers ──
  const handlePostImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    setPostImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPostImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePostImage = () => {
    setPostImage(null);
    setPostImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

      // ── Extract mentions for debugging ──
      const mentions = extractMentions(postText);
      if (mentions.length) {
        console.log('📝 Mentions detected:', mentions);
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

        closeCompose();
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

    // ── Article mode ──
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

      closeCompose();
      router.push('/articles');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Failed to create article.');
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
          <h3 className="font-head font-bold text-[var(--color-txt)]">
            {mode === 'post' ? 'Create a post' : 'Write an article'}
          </h3>
          <button onClick={closeCompose} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">
            ×
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex border-b border-[var(--color-border)] p-2 gap-1 bg-[var(--color-surface)]">
          <button
            onClick={() => setMode('post')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${
              mode === 'post'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
            }`}
          >
            Post
          </button>
          <button
            onClick={() => setMode('article')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition ${
              mode === 'article'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'
            }`}
          >
            Article
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User avatar */}
          <div className="flex items-center gap-3">
            {user?.picture ? (
              <img
                src={resolveMediaUrl(user.picture)}
                alt={user.name}
                className="flex-shrink-0 h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <AvatarPlaceholder size="h-10 w-10" />
            )}
            <div>
              <p className="text-sm font-semibold text-[var(--color-txt)]">{user?.name || 'You'}</p>
              {groupId && <p className="text-xs text-[var(--color-txt2)]">Posting in group</p>}
              {mode === 'article' && <p className="text-xs text-[var(--color-txt2)]">Article will appear in Articles</p>}
            </div>
          </div>

          {mode === 'post' && (
            <>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={postText}
                  onChange={handleTextChange}
                  placeholder="What's on your mind? Use @username to mention someone"
                  className="w-full bg-transparent border-none outline-none resize-none text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] text-sm min-h-[100px]"
                  rows={4}
                />
                {showMentions && (
                  <MentionAutocomplete
                    searchTerm={mentionSearch}
                    onSelect={handleMentionSelect}
                  />
                )}
              </div>
              <div className="text-xs text-[var(--color-txt3)] -mt-2">
                💡 Type @ to mention someone
              </div>
              {postImagePreview && (
                <div className="relative inline-block">
                  <img src={postImagePreview} alt="Preview" className="max-h-48 rounded-lg border border-[var(--color-border)]" />
                  <button
                    onClick={removePostImage}
                    className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
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
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none resize-y min-h-[150px]"
                  rows={6}
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
        </div>

        {/* Footer with actions */}
        <div className="border-t border-[var(--color-border)] p-4 flex items-center justify-between">
          <div className="flex gap-2">
            {mode === 'post' && (
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
                  onChange={handlePostImageSelect}
                />
              </button>
            )}
            {mode === 'article' && (
              <span className="text-xs text-[var(--color-txt3)]">Articles support images &amp; tags</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : mode === 'post' ? 'Post' : 'Save Article'}
          </button>
        </div>
      </div>
    </div>
  );
}