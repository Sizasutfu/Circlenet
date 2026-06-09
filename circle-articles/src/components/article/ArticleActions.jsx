'use client';
import { useState } from 'react';
import { useAuth, isAuthenticated, redirectToLogin } from '@/lib/auth';
import { apiClient } from '@/lib/api';

export default function ArticleActions({ articleId, initialLikes, initialEchoes, userLiked, userEchoed }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(userLiked);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [echoed, setEchoed] = useState(userEchoed);
  const [echoCount, setEchoCount] = useState(initialEchoes);

  const handleLike = async () => {
    if (!user && !isAuthenticated()) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${articleId}/like`, { method: 'POST' });
      setLiked(res.data.liked);
      setLikeCount(res.data.likes);
    } catch (err) { alert(err.message); }
  };

  const handleEcho = async () => {
    if (!user && !isAuthenticated()) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${articleId}/echo`, { method: 'POST' });
      setEchoed(res.data.echoed);
      setEchoCount(res.data.echoes);
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
      <button
        onClick={handleEcho}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-border bg-card text-txt2 text-sm font-semibold transition-all hover:border-accent hover:text-accent hover:bg-accent-bg ${
          echoed ? 'border-green text-green bg-green-bg' : ''
        }`}
      >
        <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-4 h-4">
          <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/>
        </svg>
        <span>{echoCount}</span>
      </button>
    </div>
  );
}