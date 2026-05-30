'use client';
import Link from 'next/link';

const PLACEHOLDER_COVER = 'https://placehold.co/800x420/111116/7c6bff?text=Article';

export default function ArticleHeader({ article }) {
  const coverUrl = article.coverImage || PLACEHOLDER_COVER;
  const dateStr = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const authorName = article.author || 'Anonymous';
  const authorAvatar = article.authorPicture
    ? article.authorPicture.startsWith('/')
      ? article.authorPicture
      : article.authorPicture
    : `https://placehold.co/48/7c6bff/fff?text=${authorName.charAt(0)}`;

  return (
    <>
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/articles" className="topbar-back" style={{ display: 'inline-flex' }}>
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" width="16" height="16">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Articles
        </Link>
      </div>

      <img className="art-cover" src={coverUrl} alt={article.title} />
      <div className="art-tags">
        {(article.tags || []).map(tag => (
          <span key={tag} className="art-tag">{tag}</span>
        ))}
      </div>
      <h1 className="art-title">{article.title}</h1>
      <div className="art-meta">
        <img className="art-author-av" src={authorAvatar} alt={authorName} />
        <div className="art-meta-info">
          <div className="art-author-name">{authorName}</div>
          <div className="art-date">{dateStr}</div>
        </div>
        <div className="art-reactions" id="article-reactions" />
      </div>
    </>
  );
}