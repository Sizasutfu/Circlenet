'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const PLACEHOLDER_COVER = 'https://placehold.co/800x420/111116/7c6bff?text=Article';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export default function ArticleHeader({ article }) {
  const [coverSrc, setCoverSrc] = useState(PLACEHOLDER_COVER);

  useEffect(() => {
    // Try multiple possible field names
    const rawUrl = article.coverImage || article.cover_image || article.image;
    if (rawUrl && typeof rawUrl === 'string' && rawUrl !== 'null') {
      // If relative, prepend backend URL
      const fullUrl = rawUrl.startsWith('/') ? `${BACKEND_URL}${rawUrl}` : rawUrl;
      setCoverSrc(fullUrl);
    } else {
      setCoverSrc(PLACEHOLDER_COVER);
    }
  }, [article.coverImage, article.cover_image, article.image]);

  const dateStr = article.createdAt
    ? new Date(article.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const authorName = article.author || 'Anonymous';
  const authorAvatarRaw = article.authorPicture || article.author_picture;
  const authorAvatar = authorAvatarRaw
    ? authorAvatarRaw.startsWith('/') ? `${BACKEND_URL}${authorAvatarRaw}` : authorAvatarRaw
    : `https://placehold.co/48/7c6bff/fff?text=${authorName.charAt(0)}`;

  return (
    <>
      <div className="mb-6">
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 text-txt2 text-sm font-semibold px-3 py-1.5 rounded-radius-sm border border-border bg-card hover:text-accent hover:border-accent hover:bg-accent-bg transition-all"
        >
          <svg fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Articles
        </Link>
      </div>

      <img
        className="w-full max-h-[420px] object-cover rounded-radius mb-8 border border-border"
        src={coverSrc}
        alt={article.title}
        onError={() => setCoverSrc(PLACEHOLDER_COVER)}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {(article.tags || []).map(tag => (
          <span key={tag} className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent-bg text-accent border border-accent-glow">
            {tag}
          </span>
        ))}
      </div>

      <h1 className="font-head text-3xl sm:text-4xl font-extrabold text-txt tracking-tight mb-5">
        {article.title}
      </h1>

      <div className="flex items-center gap-3 pb-6 mb-8 border-b border-border flex-wrap">
        <img
          className="w-10 h-10 rounded-full object-cover border-2 border-border bg-accent-bg"
          src={authorAvatar}
          alt={authorName}
          onError={(e) => { e.target.src = `https://placehold.co/48/7c6bff/fff?text=${authorName.charAt(0)}`; }}
        />
        <div className="flex-1">
          <div className="font-bold text-sm text-txt">{authorName}</div>
          <div className="text-xs text-txt3">{dateStr}</div>
        </div>
        <div className="art-reactions" id="article-reactions" />
      </div>
    </>
  );
}