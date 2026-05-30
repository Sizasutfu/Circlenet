'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useState } from 'react';

const PLACEHOLDER_IMG = 'https://placehold.co/180x120/111116/7c6bff?text=Article';

export default function ArticleListItem({ article, delay }) {
  const router = useRouter();
  const { user } = useAuth();
  const [liked, setLiked] = useState(article.userLiked);
  const [likeCount, setLikeCount] = useState(article.like_count);
  const [echoed, setEchoed] = useState(article.userEchoed);
  const [echoCount, setEchoCount] = useState(article.echo_count);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    try {
      const res = await apiClient(`/api/articles/${article.id}/like`, { method: 'POST' });
      setLiked(res.data.liked);
      setLikeCount(res.data.likes);
    } catch (err) { alert(err.message); }
  };

  const handleEcho = async (e) => {
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
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
  const dateStr = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const authorName = article.author || 'Anonymous';
  const avatarInitial = authorName.charAt(0).toUpperCase();
  const avatarUrl = article.authorPicture
    ? article.authorPicture.startsWith('/') ? article.authorPicture : article.authorPicture
    : `https://placehold.co/24/7c6bff/fff?text=${avatarInitial}`;

  return (
    <div className="art-list-item" style={{ animationDelay: `${delay}ms` }} onClick={openArticle}>
      <img
        className="art-list-cover"
        src={coverUrl}
        alt={article.title}
        onError={(e) => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
      />
      <div className="art-list-content">
        <div className="art-list-title">{article.title}</div>
        <div className="art-list-excerpt">{article.excerpt || (article.content || '').slice(0, 120)}</div>
        <div className="art-list-meta">
          <div className="art-list-author">
            <img className="art-list-avatar" src={avatarUrl} alt={authorName} />
            <span>{authorName}</span>
          </div>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <div className="art-list-tags">
            {(article.tags || []).slice(0, 2).map(tag => (
              <span key={tag} className="art-list-tag">{tag}</span>
            ))}
          </div>
        </div>
        <div className="art-list-actions" onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
          <button className={`art-act-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
            ❤️ {likeCount}
          </button>
          <button className={`art-act-btn ${echoed ? 'echoed' : ''}`} onClick={handleEcho}>
            🔁 {echoCount}
          </button>
          <button className="art-act-btn" onClick={openArticle}>
            💬 {article.comment_count || 0}
          </button>
        </div>
      </div>
    </div>
  );
}