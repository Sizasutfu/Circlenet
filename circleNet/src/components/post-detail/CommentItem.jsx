'use client';
import { useState } from 'react';
import Link from 'next/link';
import { resolveMediaUrl } from '@/lib/url';
import ReplyInput from './ReplyInput';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder'; 
function getUser(comment) {
  if (comment.user) {
    return {
      name: comment.user.name || 'Unknown',
      username: comment.user.username || 'unknown',
      picture: comment.user.picture || null,
    };
  }
  return {
    name: comment.author || 'Unknown',
    username: comment.authorUsername || 'unknown',
    picture: comment.authorPicture || null,
  };
}

export default function CommentItem({ comment, allComments, postId, onCommentAdd, showToast }) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const replies = allComments.filter(c => c.parentId === comment.id);
  const hasReplies = replies.length > 0;

  const { name, username, picture } = getUser(comment);
  const avatarUrl = resolveMediaUrl(picture);

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
              <span className="text-xs text-[var(--color-txt3)]">@{username}</span>
              <span className="text-xs text-[var(--color-txt3)]">
                · {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-[var(--color-txt)] mt-0.5 break-words">{comment.text}</p>
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