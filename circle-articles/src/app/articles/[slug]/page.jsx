import { cache } from 'react';
import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/api';
import ArticleHeader from '@/components/article/ArticleHeader';
import ArticleBody from '@/components/article/ArticleBody';
import ArticleActions from '@/components/article/ArticleActions';
import CommentSection from '@/components/article/CommentSection';
import RelatedArticles from '@/components/article/RelatedArticles';
import ShareButtons from '@/components/article/ShareButtons';

const BASE_URL = 'https://blog.circlenet.social';

// Memoized per-request so generateMetadata and the page share one fetch
const getArticle = cache(async (slug) => {
  try {
    const res = await apiClient(`/api/articles/by-slug/${slug}`);
    const article = res?.data?.article ?? res?.data ?? null;
    if (!article?.id) return null;
    return article;
  } catch {
    // Return null for any API error — callers decide whether to 404 or error
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Article Not Found', robots: 'noindex' };

  const url = `${BASE_URL}/articles/${slug}`;
  // 👇 Use the API route for the OG image
  const ogImageUrl = `${BASE_URL}/api/og/${slug}`;

  return {
    title: article.title,
    description: article.excerpt || '',
    keywords: article.tags?.slice(0, 12) || [],
    authors: article.author?.name ? [{ name: article.author.name }] : [],
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt || '',
      type: 'article',
      url,
      images: [{ url: ogImageUrl }],               // ✅ dynamic OG image
      publishedTime: article.createdAt,
      modifiedTime: article.updatedAt,
      authors: article.author?.name ? [article.author.name] : [],
      tags: article.tags ?? [],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || '',
      images: [ogImageUrl],                        // ✅ also for Twitter
    },
  };
}
export default async function ArticlePage({ params }) {
  const { slug } = await params;

  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt || '',
    url: `${BASE_URL}/articles/${slug}`,
    datePublished: article.createdAt,
    dateModified: article.updatedAt ?? article.createdAt,
    author: article.author?.name
      ? { '@type': 'Person', name: article.author.name }
      : undefined,
    image: article.coverImage ?? undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Circlenet',
      url: BASE_URL,
    },
    keywords: article.tags?.join(', ') ?? '',
  };

  let related = [];
  if (article.tags?.length) {
    try {
      const tagParams = article.tags.map(encodeURIComponent).join(',');
      const relatedRes = await apiClient(`/api/articles?tags=${tagParams}&limit=3`);
      const relatedArticles = relatedRes?.data?.articles ?? relatedRes?.articles ?? [];
      related = relatedArticles.filter((a) => a.id !== article.id);
    } catch {
      // Non-critical — page still renders without related articles
    }
  }

  return (
    <main className="page-wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleHeader article={article} />
      <ArticleBody content={article.content} />
      <ArticleActions
        articleId={article.id}
        initialLikes={article.likes?.length ?? 0}
        initialEchoes={article.echoes?.length ?? 0}
        userLiked={article.userLiked}
        userEchoed={article.userEchoed}
      />
      <ShareButtons title={article.title} />
      <RelatedArticles articles={related} />
      <CommentSection articleId={article.id} />
    </main>
  );
}