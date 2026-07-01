// src/components/articles/TopArticles.jsx
'use client';

import Link from 'next/link';

export default function TopArticles({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-4 flex items-center gap-2">
        <span className="bg-[var(--color-accent-bg)] text-[var(--color-accent)] px-3 py-1 rounded-full text-sm font-bold">⭐ Top Articles</span>
      </h2>
      <ul className="space-y-2">
        {articles.map((article) => (
          <li key={article.id}>
            <Link
              href={`/articles/${article.slug || article.id}`}
              className="text-[var(--color-txt)] hover:text-[var(--color-accent)] underline underline-offset-2 transition-colors text-sm"
            >
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}