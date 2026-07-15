'use client';
import CommentItem from './CommentItem';

export default function CommentList({ comments, postId, onCommentAdd, showToast }) {
  const topLevel = comments.filter(c => !c.parentId);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-txt2)]">
        Comments ({topLevel.length})
      </h3>
      {topLevel.length === 0 ? (
        <p className="text-sm text-[var(--color-txt3)]">No comments yet. Be the first!</p>
      ) : (
        topLevel.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            allComments={comments}
            postId={postId}
            onCommentAdd={onCommentAdd}
            showToast={showToast}
          />
        ))
      )}
    </div>
  );
}