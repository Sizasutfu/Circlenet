// src/app/post/[id]/page.jsx
import { Suspense, cache } from 'react';
import { notFound } from 'next/navigation';
import PostDetailClient from './PostDetailClient';
import { apiClient } from '@/lib/api';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.circlenet.social';
const DEFAULT_OG_IMAGE = '/icon.png';

const getPost = cache(async (id) => {
  if (!id) return null;
  try {
    const res = await apiClient(`/api/posts/${id}`);
    return res.data || res;
  } catch {
    return null;
  }
});

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value = '', max = 150) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function extractKeywords(value = '') {
  const text = cleanText(value);
  const hashtags = Array.from(new Set((text.match(/#\w+/g) || []).map((tag) => tag.toLowerCase())));
  if (hashtags.length) return hashtags.slice(0, 12);
  return text
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12);
}

function toAbsoluteUrl(path) {
  if (!path) return `${BASE_URL}${DEFAULT_OG_IMAGE}`;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${BASE_URL}${path}`;
  return `${BASE_URL}/${path}`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return {
      title: 'Post Not Found',
      description: 'This post was not found on Circlenet.',
      robots: { index: false, follow: false },
    };
  }

  const text = cleanText(post.text || '');
  const author = post.user?.name || post.author || 'Someone';
  const title = text
    ? text.length <= 65
      ? text
      : `${text.slice(0, 62).trimEnd()}…`
    : `${author} shared a post`;
  const description = text
    ? truncate(text, 150)
    : `Read ${author}'s post on Circlenet.`;
  const image = toAbsoluteUrl(post.image || post.user?.picture || DEFAULT_OG_IMAGE);
  const url = `${BASE_URL}/post/${id}`;

  return {
    title,
    description,
    keywords: extractKeywords(text),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'Circlenet',
      locale: 'en_US',
      images: [{ url: image }],
      publishedTime: post.createdAt,
      authors: [author],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@circlenet',
    },
  };
}

export default async function PostDetailPage({ params }) {
  const { id } = await params;

  if (!id || Number.isNaN(Number(id))) {
    notFound();
  }

  const post = await getPost(id);
  if (!post) {
    notFound();
  }

  // ── Build JSON‑LD structured data ──
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: cleanText(post.text || '').slice(0, 110),
    description: truncate(post.text || '', 150),
    image: toAbsoluteUrl(post.image || post.user?.picture || DEFAULT_OG_IMAGE),
    author: {
      '@type': 'Person',
      name: post.user?.name || post.author || 'Anonymous',
      url: post.user?.username ? `${BASE_URL}/profile/${post.user.username}` : undefined,
    },
    datePublished: post.createdAt,
    dateModified: post.updatedAt || post.createdAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/post/${id}`,
    },
  };

  return (
    <>
      {/* ── JSON‑LD structured data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Main content ── */}
      <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading post...</div>}>
        <PostDetailClient postId={id} />
      </Suspense>
    </>
  );
}