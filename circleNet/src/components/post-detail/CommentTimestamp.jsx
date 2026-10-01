'use client';
import { useEffect, useState } from 'react';

function formatRelative(dateString) {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function CommentTimestamp({ date, className = '' }) {
  // Server renders a stable absolute (UTC) string; client swaps to relative
  // after mount. The `mounted` gate guarantees no mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const fallback = (() => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    // Fixed, timezone-independent format — identical on server & client.
    return d.toISOString().slice(0, 10);
  })();

  return (
    <span className={className} suppressHydrationWarning>
      {mounted ? formatRelative(date) : fallback}
    </span>
  );
}