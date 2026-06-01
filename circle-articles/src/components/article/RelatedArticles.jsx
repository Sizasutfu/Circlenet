'use client';
import Link from 'next/link';

const PLACEHOLDER = 'https://placehold.co/400x240/16161c/7c6bff?text=Article';

export default function RelatedArticles({ articles }) {
  if (!articles || articles.length === 0) {
    return (
      <section className="art-related">
        <div className="art-related-title">Related Articles</div>
        <div style={{ color: 'var(--txt3)' }}>No related articles found.</div>
      </section>
    );
  }

  return (
    <section className="art-related">
      <div className="art-related-title">Related Articles</div>
      <div className="art-related-grid">
        {articles.map((art) => (
          <Link
            key={art.id}
            href={`/articles/${art.slug}`}
            className="art-related-card"
            target="_blank"
            rel="noopener"
          >
            <img
              className="art-related-cover"
              src={art.coverImage || PLACEHOLDER}
              alt={art.title}
              onError={(e) => { e.target.src = PLACEHOLDER; }}
            />
            <div className="art-related-body">
              <div className="art-related-card-title">{art.title}</div>
              <div className="art-related-author">{art.author || 'Anonymous'}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}