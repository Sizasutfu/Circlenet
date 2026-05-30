import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/api';
import ArticleHeader from '@/components/article/ArticleHeader';
import ArticleBody from '@/components/article/ArticleBody';
import ArticleActions from '@/components/article/ArticleActions';
import CommentSection from '@/components/article/CommentSection';
import RelatedArticles from '@/components/article/RelatedArticles';
import ShareButtons from '@/components/article/ShareButtons';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const res = await apiClient(`/api/articles/by-slug/${slug}`);
    // Extract article from response (nested or direct)
    const article = res.data?.article || res.data || res;
    return {
      title: article.title || 'Article',
      description: article.excerpt || '',
    };
  } catch {
    return { title: 'Article Not Found' };
  }
}

export default async function ArticlePage({ params }) {
  const { slug } = await params;
  let article;
  try {
    const res = await apiClient(`/api/articles/by-slug/${slug}`);
    console.log('🔍 Raw article response:', JSON.stringify(res, null, 2));

    // Try to extract the article object from common response shapes
    article = res.data?.article || res.data || res;

    if (!article || !article.id) {
      console.error('❌ No article or missing id in response:', res);
      notFound();
    }
    console.log('✅ Extracted article ID:', article.id);
  } catch (err) {
    console.error('Failed to fetch article:', err);
    notFound();
  }

  let related = [];
  if (article.tags?.length) {
    try {
      const relatedRes = await apiClient(`/api/articles?tags=${article.tags.join(',')}&limit=3`);
      const relatedArticles = relatedRes.data?.articles || relatedRes.articles || [];
      related = relatedArticles.filter(a => a.id !== article.id);
    } catch (e) {
      console.error('Failed to fetch related articles:', e);
    }
  }

  const articleId = article.id; // now guaranteed to be a number

  return (
    <main className="page-wrap">
      <ArticleHeader article={article} />
      <ArticleBody content={article.content} />
      <ArticleActions
        articleId={articleId}
        initialLikes={article.likes?.length || 0}
        initialEchoes={article.echoes?.length || 0}
        userLiked={article.userLiked}
        userEchoed={article.userEchoed}
      />
      <ShareButtons title={article.title} />
      <RelatedArticles articles={related} />
      <CommentSection articleId={articleId} />
    </main>
  );
}