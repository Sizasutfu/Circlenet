// components/articles/ArticleCard.jsx
'use client';
import { useRouter } from 'next/navigation';
import { useAuth, redirectToLogin } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useState } from 'react';

const PLACEHOLDER_IMG = 'https://placehold.co/600x340/111116/7c6bff?text=Article';

export default function ArticleCard({ article, delay }) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState(article.userLiked);
  const [likeCount, setLikeCount] = useState(article.like_count);
  const [echoed, setEchoed] = useState(article.userEchoed);
  const [echoCount, setEchoCount] = useState(article.echo_count);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${article.id}/like`, { method: 'POST' });
      setLiked(res.data.liked);
      setLikeCount(res.data.likes);
    } catch (err) { alert(err.message); }
  };

  const handleEcho = async (e) => {
    e.stopPropagation();
    if (!user) { redirectToLogin(); return; }
    try {
      const res = await apiClient(`/api/articles/${article.id}/echo`, { method: 'POST' });
      setEchoed(res.data.echoed);
      setEchoCount(res.data.echoes);
    } catch (err) { alert(err.message); }
  };

  const openArticle = () => {
    window.open(`/articles/${article.slug}`, '_blank', 'noopener');
  };

  const coverUrl = article.coverImage || PLACEHOLDER_IMG;
  const tags = (article.tags || []).slice(0,2);
  const dateStr = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const authorName = article.author || 'Anonymous';
  const avatarInitial = authorName.charAt(0).toUpperCase();
  const avatarUrl = article.authorPicture
    ? article.authorPicture.startsWith('/') ? article.authorPicture : article.authorPicture
    : `https://placehold.co/56/7c6bff/fff?text=${avatarInitial}`;

  return (
    <div
      className="bg-card border border-border rounded-radius overflow-hidden cursor-pointer transition-all duration-200 hover:border-border2 hover:-translate-y-0.5 hover:shadow-shadow animate-card-in"
      style={{ animationDelay: `${delay}ms` }}
      onClick={openArticle}
    >
      <img
        className="w-full h-[220px] object-cover bg-surface"
        src={coverUrl}
        alt={article.title}
        onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />
      <div className="p-4">
        <div className="flex justify-between items-center mb-2 text-xs">
          <span className="text-txt3" suppressHydrationWarning>{dateStr}</span>
          <div className="flex gap-1.5">
            {tags.map(t => (
              <span key={t} className="bg-accent-bg text-accent rounded-full px-2 py-0.5 text-[10px] font-bold">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="font-head text-lg font-bold text-txt mb-2 line-clamp-2">
          {article.title}
        </div>
        <div className="text-txt2 text-sm mb-4 line-clamp-3">
          {article.excerpt || (article.content || '').slice(0,120)}
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              className="w-7 h-7 rounded-full object-cover bg-accent-bg"
              src={avatarUrl}
              alt={avatarInitial}
              onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/56/7c6bff/fff?text=${avatarInitial}`; }}
            />
            <span className="text-xs font-semibold text-txt2">{authorName}</span>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-all ${
                liked ? 'text-rose' : 'text-txt2 hover:text-accent'
              }`}
              onClick={handleLike}
            >
              <svg fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-3.5 h-3.5">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
              <span>{likeCount}</span>
            </button>
            <button
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold transition-all ${
                echoed ? 'text-green' : 'text-txt2 hover:text-accent'
              }`}
              onClick={handleEcho}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-3.5 h-3.5">
                <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/>
              </svg>
              <span>{echoCount}</span>
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold text-txt2 hover:text-accent transition-all"
              onClick={openArticle}
            >
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-3.5 h-3.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <span>{article.comment_count || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}