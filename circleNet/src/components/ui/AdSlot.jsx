'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';

export default function AdSlot({
  placement = 'feed',
  page = null, // e.g., 'profile', 'explore'
  className = '',
  onAdLoaded = null,
}) {
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const impressionSent = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAd = async () => {
      try {
        const url = `/api/ads?placement=${placement}${page ? `&page=${page}` : ''}`;
        const res = await apiClient(url);
        if (isMounted) {
          setAd(res.data || null);
          setLoading(false);
          // Track impression (only once per ad load)
          if (res.data && res.data.id && !impressionSent.current) {
            impressionSent.current = true;
            apiClient(`/api/ads/${res.data.id}/impression`, { method: 'POST' }).catch(() => {});
          }
          if (onAdLoaded) onAdLoaded(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };
    fetchAd();
    return () => { isMounted = false; };
  }, [placement, page, onAdLoaded]);

  if (loading) {
    return (
      <div className={`ad-slot-placeholder bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 animate-pulse ${className}`}>
        <div className="h-20 bg-[var(--color-border)] rounded" />
      </div>
    );
  }

  if (!ad) {
    // No ad available – render nothing or a subtle placeholder
    return null;
  }

  const handleClick = (e) => {
    // Track click
    if (ad.id) {
      apiClient(`/api/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    }
    // Let the link handle navigation
  };

  return (
    <div className={`ad-slot bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <a
        href={ad.link_url}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="block"
      >
        <img
          src={ad.image_url}
          alt={ad.title}
          className="w-full h-auto object-cover"
          loading="lazy"
        />
        <div className="p-2 text-xs text-[var(--color-txt3)] text-center bg-[var(--color-surface)]/80">
          Sponsored
        </div>
      </a>
    </div>
  );
}