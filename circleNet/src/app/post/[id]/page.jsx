// src/app/post/[id]/page.jsx
import { Suspense } from 'react';
import PostDetailClient from './PostDetailClient';
import { apiClient } from '@/lib/api';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const post = await apiClient(`/api/posts/${id}`);
    const data = post.data || post;
    return {
      title: `${data.text?.slice(0, 60)} | Circlenet`,
      description: data.text?.slice(0, 160) || 'View this post on Circlenet',
    };
  } catch {
    return {
      title: 'Post | Circlenet',
      description: 'View this post on Circlenet.',
    };
  }
}

export default async function PostDetailPage({ params }) {
  // ✅ Await params to get the id
  const { id } = await params;

  // ✅ If id is missing or invalid, return a 404 or redirect
  if (!id || isNaN(Number(id))) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">Invalid post ID.</p>
        <button
          onClick={() => window.location.href = '/feed'}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading post...</div>}>
      <PostDetailClient postId={id} />
    </Suspense>
  );
}