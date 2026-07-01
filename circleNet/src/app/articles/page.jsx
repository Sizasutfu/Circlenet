// src/app/articles/page.jsx
import { apiClient } from '@/lib/api';
import ArticleGrid from '@/components/articles/ArticleGrid';
import TopArticles from '@/components/articles/TopArticles';

export const metadata = {
  title: 'Articles | Circlenet',
  description:
    'Browse the latest Circlenet articles, guides, and community stories curated for modern readers.',
  alternates: {
    canonical: '/articles',
  },
};

export default async function ArticlesPage() {
  let articles = [];
  let total = 0;
  let topArticles = [];

  try {
    // Fetch main articles
    const response = await apiClient('/api/articles?page=1&limit=20');
    articles = response.data?.articles || response.articles || [];
    total = response.data?.total || articles.length;
  } catch (err) {
    console.error('Failed to fetch articles:', err);
  }

  try {
    // Fetch top articles – adjust the endpoint to match your backend
    const topRes = await apiClient('/api/articles/top?limit=4');
    topArticles = topRes.data?.articles || topRes.articles || [];
  } catch (err) {
    console.warn('Failed to fetch top articles:', err);
    // Fallback: use first 4 articles as "top" (if available)
    if (articles.length) {
      topArticles = articles.slice(0, 4);
    }
  }

  return (
    <>
      <TopArticles articles={topArticles} />
      <ArticleGrid initialArticles={articles} initialTotal={total} />
    </>
  );
}