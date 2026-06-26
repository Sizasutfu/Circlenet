// src/components/ui/PostCard.jsx
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useLightbox } from "@/hooks/useLightbox";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
  return `${base}${url}`;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onRepost,
  onShare,
}) {
  const {
    id,
    text,
    image,
    video,
    createdAt,
    user,
    likes = [],
    comments = [],
    reposts = [],
    shares = 0,
  } = post;

  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(likes.length || 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const { openLightbox } = useLightbox();
  const videoRef = useRef(null);

  const displayName = post.user?.name || post.author || "Anonymous";
  const username = post.user?.username || post.authorUsername || "";
  const avatarUrl = resolveMediaUrl(
    post.user?.picture || post.authorPicture || null,
  );

  const postImageUrl = resolveMediaUrl(image);
  const postVideoUrl = resolveMediaUrl(video);

  // ── Debug logging ──
  console.log("📦 PostCard received:", {
    id,
    text: text?.slice(0, 30),
    image: postImageUrl,
    video: postVideoUrl,
    rawVideo: video,
  });

  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = stringToColor(displayName);

  const formattedDate = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
    if (onLike) onLike(id);
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);
  const shouldTruncate = text?.length > 200 && !isExpanded;

  const handleImageClick = (e) => {
    e.preventDefault();
    if (postImageUrl) {
      openLightbox([postImageUrl], 0);
    }
  };

  const handleVideoError = () => {
    console.warn("⚠️ Video failed to load:", postVideoUrl);
    setVideoError(true);
  };

  // ── Render media ──
  const renderMedia = () => {
    // If we have a video URL
    if (postVideoUrl) {
      return (
        <div className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border)] bg-black/5">
          {videoError ? (
            <div className="p-6 text-center text-[var(--color-txt2)] text-sm">
              <svg
                className="w-10 h-10 mx-auto mb-2 text-[var(--color-txt3)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path d="M15 10l4.553-2.277A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Video failed to load</p>
              <a
                href={postVideoUrl}
                target="_blank"
                rel="noopener"
                className="text-[var(--color-accent)] hover:underline text-xs"
              >
                View directly
              </a>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={postVideoUrl}
              controls
              playsInline
              className="w-full h-auto max-h-96 object-contain"
              poster={postImageUrl || undefined}
              onError={handleVideoError}
              preload="metadata"
            />
          )}
        </div>
      );
    }

    // If we have an image
    if (postImageUrl) {
      return (
        <div className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border)]">
          <img
            src={postImageUrl}
            alt="Post image"
            className="w-full h-auto max-h-96 object-cover cursor-pointer hover:opacity-90 transition"
            onClick={handleImageClick}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-4 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] hover:shadow-[var(--color-shadow)] transition-shadow duration-200">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
          style={{ background: avatarUrl ? "transparent" : avatarColor }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            initial
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link href={`/post/${id}`} className="block">
            {/* Header */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span className="font-semibold text-[var(--color-txt)] text-sm">
                {displayName}
              </span>
              <span className="text-[var(--color-txt2)] text-xs">
                @{username}
              </span>
              <span className="text-[var(--color-txt3)] text-xs">
                · {formattedDate} at {formattedTime}
              </span>
            </div>

            {/* Text */}
            <div className="mt-1 text-[var(--color-txt)] text-sm leading-relaxed whitespace-pre-wrap break-words">
              {shouldTruncate ? text.slice(0, 200) + "…" : text}
              {text?.length > 200 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleExpand();
                  }}
                  className="ml-1 text-[var(--color-accent)] hover:underline text-xs font-medium"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {/* Media */}
            {renderMedia()}
          </Link>

          {/* Engagement bar */}
          <div className="mt-3 flex items-center gap-4 text-[var(--color-txt2)] text-xs">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition hover:text-[var(--color-rose)] ${
                isLiked ? "text-[var(--color-rose)]" : ""
              }`}
            >
              <svg
                className="w-4 h-4"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
              <span>{likeCount}</span>
            </button>
            <button
              onClick={() => onComment && onComment(id)}
              className="flex items-center gap-1 transition hover:text-[var(--color-accent)]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              <span>{comments.length || 0}</span>
            </button>
            <button
              onClick={() => onRepost && onRepost(id)}
              className="flex items-center gap-1 transition hover:text-[var(--color-green)]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 014-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              <span>{reposts.length || 0}</span>
            </button>
            <button
              onClick={() => onShare && onShare(id)}
              className="flex items-center gap-1 transition hover:text-[var(--color-accent)]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>{shares || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
