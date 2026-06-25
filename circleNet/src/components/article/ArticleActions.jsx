'use client';
import { useState } from 'react';
import { useAuth, isAuthenticated, redirectToLogin } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function ArticleActions({ articleId, initialLikes, userLiked }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(userLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);

  const handleLike = async () => {
    if (!user && !isAuthenticated()) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${articleId}/like`, { method: 'POST' });
      setLiked(res.data.liked);
      setLikeCount(res.data.likes);
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="flex gap-3 items-center flex-wrap">
      <button
        onClick={handleLike}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-border bg-card text-txt2 text-sm font-semibold transition-all hover:border-accent hover:text-accent hover:bg-accent-bg ${
          liked ? 'border-rose text-rose bg-rose-bg' : ''
        }`}
      >
        <svg fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
        <span>{likeCount}</span>
      </button>
    </div>
  );
}