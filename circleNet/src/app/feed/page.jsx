// src/app/feed/page.jsx
import FeedClient from './FeedClient';
import { apiClient } from '@/lib/api';

export const metadata = {
  title: 'Feed | Circlenet',
  description: 'Stay updated with posts from the community.',
};

export default async function FeedPage() {
  let initialPosts = [];
  try {
    const res = await apiClient('/api/posts?feed=global&page=1&limit=20');
    initialPosts = res.data?.posts || [];
  } catch (err) {
    console.error('Failed to fetch initial posts:', err);
  }

  return <FeedClient initialPosts={initialPosts} />;
}