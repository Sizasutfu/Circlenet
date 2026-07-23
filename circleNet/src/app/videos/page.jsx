import VideoFeedClient from './VideoFeedClient';
import { apiClient } from '@/lib/api';

export const metadata = {
  title: 'Videos',
  description: 'Watch the latest videos from the community.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

async function getVideos() {
  try {
    const res = await apiClient('/api/posts?media=video&limit=50');
    return res.data?.posts || res.data || [];
  } catch {
    return [];
  }
}

export default async function VideosPage() {
  const initialVideos = await getVideos();
  return <VideoFeedClient initialVideos={initialVideos} />;
}