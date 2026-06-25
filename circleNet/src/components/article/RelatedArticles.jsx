'use client';
import Link from 'next/link';

const PLACEHOLDER = 'https://placehold.co/400x240/16161c/7c6bff?text=Article';

export default function RelatedArticles({ articles }) {
  if (!articles || articles.length === 0) {
    return (
      <section className="mt-12">
        <div className="font-head text-lg font-bold text-txt mb-4 pb-3 border-b border-border">
          Related Articles
        </div>
        <div className="text-txt3">No related articles found.</div>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <div className="font-head text-lg font-bold text-txt mb-4 pb-3 border-b border-border">
        Related Articles
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
        {articles.map((art) => (
          <Link
            key={art.id}
            href={`/articles/${art.slug}`}
            className="bg-card border border-border rounded-radius-sm overflow-hidden cursor-pointer transition-all duration-200 hover:border-border2 hover:-translate-y-0.5 hover:shadow-shadow no-underline block"
            target="_blank"
            rel="noopener"
          >
            <img
              className="w-full h-[120px] object-cover bg-surface block"
              src={art.coverImage || PLACEHOLDER}
              alt={art.title}
              onError={(e) => { e.target.src = PLACEHOLDER; }}
            />
            <div className="p-2.5">
              <div className="text-txt text-sm font-bold leading-tight mb-1 line-clamp-2">
                {art.title}
              </div>
              <div className="text-txt3 text-xs">{art.author || 'Anonymous'}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}