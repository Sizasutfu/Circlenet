'use client';
import { useState } from 'react';
import Link from 'next/link';
import { resolveMediaUrl } from '@/lib/url';
import ReplyInput from './ReplyInput';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';
import { formatPostText } from '@/lib/formatText';

function getUser(comment) {
  // Try multiple possible data structures
  if (comment.user) {
    return {
      name: comment.user.name || comment.user.displayName || 'Unknown',
      username: comment.user.username || comment.user.handle || 'unknown',
      picture: comment.user.picture || comment.user.avatar || null,
      verified: comment.user.verified || false,
    };
  }
  
  // Check for author fields (from API)
  if (comment.author || comment.authorName) {
    return {
      name: comment.author || comment.authorName || 'Unknown',
      username: comment.authorUsername || comment.username || 'unknown',
      picture: comment.authorPicture || comment.authorAvatar || null,
      verified: comment.authorVerified || false,
    };
  }
  
  // Check for direct fields on comment
  return {
    name: comment.name || comment.author || 'Unknown',
    username: comment.username || comment.authorUsername || 'unknown',
    picture: comment.picture || comment.authorPicture || null,
    verified: comment.verified || false,
  };
}

export default function CommentItem({ comment, allComments, postId, onCommentAdd, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const replies = allComments.filter(c => c.parentId === comment.id);
  const hasReplies = replies.length > 0;

  const { name, username, picture, verified } = getUser(comment);
  const avatarUrl = resolveMediaUrl(picture);
  const formattedText = formatPostText(comment.text);

  const toggleReplies = () => setExpanded(!expanded);
  const toggleReply = () => setReplying(!replying);

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-3 hover:shadow-[var(--color-shadow)] transition-shadow">
      {/* Grid layout: avatar column + content column */}
      <div className="grid grid-cols-[2.5rem,1fr] gap-3">
        {/* Avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="h-8 w-8" />
        )}

        {/* Content column */}
        <div className="min-w-0">
          <Link href={`/comment/${comment.id}`} className="block hover:bg-[var(--color-surface)] rounded-md transition p-1 -m-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[var(--color-txt)]">{name}</span>
              {verified && (
                <svg className="w-4 h-4 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-xs text-[var(--color-txt3)]">@{username}</span>
              <span className="text-xs text-[var(--color-txt3)]">
                · {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            {/* ─── Formatted text with mentions ─── */}
            <p 
              className="text-sm text-[var(--color-txt)] mt-0.5 break-words"
              dangerouslySetInnerHTML={{ __html: formattedText }}
            />
          </Link>

          {/* Actions – now inside content, wraps on small screens */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-3 mt-1 max-w-full">
            <button
              onClick={toggleReply}
              className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition whitespace-nowrap"
            >
              {replying ? 'Cancel' : 'Reply'}
            </button>
            {hasReplies && (
              <button
                onClick={toggleReplies}
                className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition whitespace-nowrap"
              >
                {expanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>

          {/* Reply input */}
          {replying && (
            <div className="mt-3 max-w-full">
              <ReplyInput
                postId={postId}
                parentId={comment.id}
                onCommentAdd={onCommentAdd}
                showToast={showToast}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested replies – responsive indentation */}
      {hasReplies && expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-[var(--color-border)] pl-3 sm:pl-4 ml-6 sm:ml-11">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              allComments={allComments}
              postId={postId}
              onCommentAdd={onCommentAdd}
              showToast={showToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}