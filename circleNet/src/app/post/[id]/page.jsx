// src/app/post/[id]/page.jsx
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
      description: 'View this post on Circlenet',
    };
  }
}

export default async function PostDetailPage({ params }) {
  const { id } = await params;
  return <PostDetailClient postId={id} />;
}