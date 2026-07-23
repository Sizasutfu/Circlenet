'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLightbox } from '@/hooks/useLightbox';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { resolveMediaUrl } from '@/lib/url';
import Link from 'next/link';

function VideoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-[9/16] bg-[var(--color-surface)] rounded-xl" />
      ))}
    </div>
  );
}

function VideoCard({ video, onClick }) {
  const thumbnail = resolveMediaUrl(video.thumbnail || video.image || '');
  const user = video.user || {};

  return (
    <div
      className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition"
      onClick={() => onClick(video)}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--color-txt3)]">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
        <svg className="w-12 h-12 text-white opacity-80 group-hover:opacity-100 transition" fill="currentColor" viewBox="0 0 24 24">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
        <div className="flex items-center gap-1 text-white text-xs truncate bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>{video.videoViews || 0}</span>
        </div>
        <div className="flex items-center gap-1 text-white text-xs truncate bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm ml-auto">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="truncate max-w-[60px]">{user.name || 'Anonymous'}</span>
        </div>
      </div>
    </div>
  );
}

export default function VideoFeedClient({ initialVideos = [] }) {
  const { openLightbox } = useLightbox();
  const { user } = useAuth();
  const [videos, setVideos] = useState(initialVideos);
  const [loading, setLoading] = useState(!initialVideos.length);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialVideos.length) return;
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const res = await apiClient('/api/posts?media=video&limit=50');
        const posts = res.data?.posts || res.data || [];
        setVideos(posts);
      } catch (err) {
        setError(err.message || 'Failed to load videos');
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [initialVideos]);

  const handleVideoClick = useCallback(
    (clickedVideo) => {
      const index = videos.findIndex((v) => v.id === clickedVideo.id);
      if (index === -1) return;

      // Build Lightbox items from videos
      const items = videos.map((v) => ({
        src: resolveMediaUrl(v.video) || '',
        type: 'video',
        meta: {
          postId: v.id,
          caption: v.text || '',
          name: v.user?.name || v.author || 'Anonymous',
          username: v.user?.username || '',
          userId: v.user?.id || v.authorId || v.userId,
          picture: resolveMediaUrl(v.user?.picture || v.authorPicture || null),
          poster: resolveMediaUrl(v.thumbnail || v.image || null),
        },
      }));

      // Set vertical navigation mode (TikTok-style)
      localStorage.setItem('circle_lb_nav_axis', 'ud');

      openLightbox(items, index);
    },
    [videos, openLightbox]
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-6">Videos</h1>
        <VideoGridSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <p className="text-[var(--color-rose)]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-full"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!videos.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 text-center">
        <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-4">Videos</h1>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-[var(--color-txt3)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <h2 className="text-lg font-semibold text-[var(--color-txt)]">No videos yet</h2>
          <p className="text-sm text-[var(--color-txt2)] mt-1">Be the first to share a video!</p>
          {user && (
            <Link href="/compose" className="inline-block mt-4 px-6 py-2 bg-[var(--color-accent)] text-white rounded-full hover:bg-[var(--color-accent-h)] transition">
              Create a video post
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-6">Videos</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} onClick={handleVideoClick} />
        ))}
      </div>
      <p className="text-center text-sm text-[var(--color-txt3)] mt-6">Tap a video to watch in full screen</p>
    </div>
  );
}