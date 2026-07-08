// app/comment/[id]/page.jsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/api';
import CommentDetailClient from './CommentDetailClient';

async function getComment(id) {
  try {
    const res = await apiClient(`/api/comments/${id}`);
    return res.data || res;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  // ✅ Await params before accessing its properties
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) {
    return { title: 'Comment not found' };
  }
  return {
    title: `Comment by ${comment.user?.name || 'User'}`,
    description: comment.text?.slice(0, 160) || 'View comment on Circlenet',
  };
}

export default async function CommentDetailPage({ params }) {
  // ✅ Also await params here
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) notFound();

  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading comment...</div>}>
      <CommentDetailClient commentId={id} initialComment={comment} />
    </Suspense>
  );
}