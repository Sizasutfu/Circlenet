'use client';
import { useState } from 'react';
import Link from 'next/link';
import { resolveMediaUrl, stringToColor } from './utils';
import ReplyInput from './ReplyInput';

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
  const initial = name.charAt(0).toUpperCase();
  const color = stringToColor(name);

  const toggleReplies = () => setExpanded(!expanded);
  const toggleReply = () => setReplying(!replying);

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-radius-sm)] p-3 hover:shadow-[var(--color-shadow)] transition-shadow">
      <div className="flex gap-3">
        <div
          className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden"
          style={{ background: avatarUrl ? 'transparent' : color }}
        >
          {avatarUrl ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" /> : initial}
        </div>
        <Link href={`/comment/${comment.id}`} className="flex-1 min-w-0 hover:bg-[var(--color-surface)] rounded-md transition p-1 -m-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-[var(--color-txt)]">{name}</span>
            <span className="text-xs text-[var(--color-txt3)]">@{username}</span>
            <span className="text-xs text-[var(--color-txt3)]">
              · {new Date(comment.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-[var(--color-txt)] mt-0.5 break-words">{comment.text}</p>
        </Link>
      </div>

      <div className="flex items-center gap-3 mt-1 ml-11">
        <button
          onClick={toggleReply}
          className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition"
        >
          {replying ? 'Cancel' : 'Reply'}
        </button>
        {hasReplies && (
          <button
            onClick={toggleReplies}
            className="text-xs text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition"
          >
            {expanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>

      {replying && (
        <div className="mt-3 ml-11">
          <ReplyInput
            postId={postId}
            parentId={comment.id}
            onCommentAdd={onCommentAdd}
            showToast={showToast}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}

      {hasReplies && expanded && (
        <div className="ml-11 mt-3 space-y-3 border-l-2 border-[var(--color-border)] pl-4">
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