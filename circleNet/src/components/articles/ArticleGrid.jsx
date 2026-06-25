'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ArticleCard from './ArticleListItem';
import ArticleFilters from './ArticleFilters';
import Pagination from './Pagination';

export default function ArticleGrid({ initialArticles = [] }) {
  // Ensure initialArticles is always an array
  const safeArticles = Array.isArray(initialArticles) ? initialArticles : [];
  const [articles] = useState(safeArticles);
  const [filtered, setFiltered] = useState(safeArticles);
  const [page, setPage] = useState(1);
  const [activeTag, setActiveTag] = useState('');
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('search')?.trim() || '';
  const perPage = 6;

  useEffect(() => {
    let filteredList = Array.isArray(articles) ? [...articles] : [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredList = filteredList.filter((a) =>
        a.title?.toLowerCase().includes(term) ||
        (a.excerpt || '').toLowerCase().includes(term) ||
        (a.author || '').toLowerCase().includes(term)
      );
    }
    if (activeTag) {
      filteredList = filteredList.filter((a) => (a.tags || []).includes(activeTag));
    }
    setFiltered(filteredList);
    setPage(1);
  }, [searchTerm, activeTag, articles]);

  // Guard against undefined or non-array filtered
  const filteredArray = Array.isArray(filtered) ? filtered : [];
  const start = (page - 1) * perPage;
  const paginated = filteredArray.slice(start, start + perPage);
  const totalPages = Math.max(1, Math.ceil(filteredArray.length / perPage));

  const allTags = [...new Set((articles || []).flatMap(a => a.tags || []))];

  return (
    <>
      <ArticleFilters activeTag={activeTag} setActiveTag={setActiveTag} allTags={allTags} />
      <div className="flex flex-col mt-8">
        {paginated.map((article, idx) => (
          <ArticleCard key={article.id} article={article} delay={idx * 45} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} />
    </>
  );
}