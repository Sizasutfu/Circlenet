'use client';
import { useRouter } from 'next/navigation';
import { useAuth, redirectToLogin } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useState } from 'react';

const PLACEHOLDER_IMG = 'https://placehold.co/180x120/111116/7c6bff?text=Article';

export default function ArticleListItem({ article, delay }) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState(article.userLiked);
  const [likeCount, setLikeCount] = useState(article.like_count);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${article.id}/like`, { method: 'POST' });
      setLiked(res.data.liked);
      setLikeCount(res.data.likes);
    } catch (err) { alert(err.message); }
  };

  const openArticle = () => {
    window.open(`/articles/${article.slug}`, '_blank', 'noopener');
  };

  const coverUrl = article.coverImage || PLACEHOLDER_IMG;
  const dateStr = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const authorName = article.author || 'Anonymous';
  const avatarInitial = authorName.charAt(0).toUpperCase();
  const avatarUrl = article.authorPicture
    ? article.authorPicture.startsWith('/') ? article.authorPicture : article.authorPicture
    : `https://placehold.co/24/7c6bff/fff?text=${avatarInitial}`;

  return (
    <div
      className="flex gap-6 py-6 border-b border-border cursor-pointer hover:bg-surface transition-all"
      style={{ animationDelay: `${delay}ms` }}
      onClick={openArticle}
    >
      <img
        className="w-[180px] h-[120px] object-cover rounded-radius-sm bg-surface flex-shrink-0"
        src={coverUrl}
        alt={article.title}
        onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />
      <div className="flex-1">
        <div className="font-head text-xl font-bold text-txt mb-2 line-clamp-2">{article.title}</div>
        <div className="text-txt2 text-sm mb-3 line-clamp-2">{article.excerpt || (article.content || '').slice(0, 120)}</div>
        <div className="flex items-center gap-4 text-xs text-txt3 flex-wrap">
          <div className="flex items-center gap-1">
            <img className="w-6 h-6 rounded-full object-cover" src={avatarUrl} alt={authorName} />
            <span>{authorName}</span>
          </div>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <div className="flex gap-1">
            {(article.tags || []).slice(0, 2).map(tag => (
              <span key={tag} className="bg-accent-bg text-accent px-2 py-0.5 rounded-full text-xs font-bold">{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
          {/* Like button with heart SVG */}
          <button
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-all ${
              liked ? 'text-rose' : 'text-txt2 hover:text-accent'
            }`}
            onClick={handleLike}
          >
            <svg
              fill={liked ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
            {likeCount}
          </button>

          {/* Comment button with bubble SVG */}
          <button
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-txt2 hover:text-accent transition-all"
            onClick={openArticle}
          >
            <svg
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            {article.comment_count || 0}
          </button>
        </div>
      </div>
    </div>
  );
}