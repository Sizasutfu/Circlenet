'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import { extractMentions } from '@/lib/formatText';

// ─── Mention Autocomplete Component ──────────────────────────────────
function MentionAutocomplete({ searchTerm, onSelect, position }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

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
          setSelectedIndex(0);
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
    <div 
      className="absolute z-50 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden min-w-[200px] max-h-60 overflow-y-auto"
      style={{ 
        bottom: '100%',
        left: position?.left || 0,
        marginBottom: '4px'
      }}
    >
      {suggestions.map((user, index) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.username)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-surface)] transition ${
            index === selectedIndex ? 'bg-[var(--color-surface)]' : ''
          }`}
          onMouseEnter={() => setSelectedIndex(index)}
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

export default function ReplyInput({ postId, parentId, onCommentAdd, showToast, onCancel }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // ── Mention state ──
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionPosition, setMentionPosition] = useState(null);
  const inputRef = useRef(null);

  // ── Handle text change with mention detection ──
  const handleTextChange = (e) => {
    const newText = e.target.value;
    const cursor = e.target.selectionStart;
    setText(newText);

    const textBeforeCursor = newText.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1 && lastAtIndex < cursor) {
      const searchTerm = textBeforeCursor.slice(lastAtIndex + 1);
      if (!searchTerm.includes(' ') && searchTerm.length > 0) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setMentionPosition({
            left: rect.left + 20,
          });
        }
        return;
      }
    }
    
    setShowMentions(false);
    setMentionSearch('');
  };

  // ── Handle mention selection ──
  const handleMentionSelect = (username) => {
    const cursor = inputRef.current?.selectionStart || text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const before = text.slice(0, lastAtIndex);
      const after = text.slice(cursor);
      const newText = `${before}@${username} ${after}`;
      setText(newText);
      
      setTimeout(() => {
        if (inputRef.current) {
          const newCursor = before.length + username.length + 2;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    }
    
    setShowMentions(false);
    setMentionSearch('');
  };

  // ── Keyboard navigation ──
  const handleKeyDown = (e) => {
    // Close mentions on Escape
    if (e.key === 'Escape') {
      setShowMentions(false);
      setMentionSearch('');
      return;
    }
    
    // Submit on Enter (if mentions are not shown)
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiClient(`/api/posts/${postId}/comment`, {
        method: 'POST',
        body: { text: text.trim(), parentId },
      });
      const newComment = res.data || res;
      onCommentAdd(newComment);
      setText('');
      showToast('Reply added!');
      if (onCancel) onCancel();
    } catch (err) {
      showToast(err.message || 'Failed to add reply.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-2 relative">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}  // ✅ Single onKeyDown handler
          placeholder="Write a reply… Use @ to mention someone"
          className="w-full bg-[var(--color-surface)] rounded-[var(--radius-radius-sm)] px-3 py-1.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] border border-[var(--color-border)] focus:border-[var(--color-accent)] focus:outline-none"
          disabled={submitting}
        />
        
        {/* ─── Mention Autocomplete ──────────────────────── */}
        {showMentions && (
          <MentionAutocomplete
            searchTerm={mentionSearch}
            onSelect={handleMentionSelect}
            position={mentionPosition}
          />
        )}
      </div>
      
      <button
        onClick={handleSubmit}
        disabled={submitting || !text.trim()}
        className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-h)] transition disabled:opacity-50 flex items-center justify-center"
        aria-label="Reply"
        title="Reply"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </button>
    </div>
  );
}