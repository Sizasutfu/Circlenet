import { apiClient } from '@/lib/api';
import ArticleGrid from '@/components/articles/ArticleGrid';

export default async function ArticlesPage() {
  let articles = [];
  let total = 0;

  try {
    const response = await apiClient('/api/articles?page=1&limit=20');
    // Extract articles from the nested `data` property (based on your API response)
    articles = response.data?.articles || response.articles || [];
    total = response.data?.total || articles.length;
  } catch (err) {
    console.error('Failed to fetch articles:', err);
  }

  return <ArticleGrid initialArticles={articles} initialTotal={total} />;
}