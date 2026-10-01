export { default as Toast } from './Toast';
export { default as CreatorProfile } from './CreatorProfile';
export { default as CommentInput } from './CommentInput';
export { default as CommentList } from './CommentList';
export { default as CommentItem } from './CommentItem';
export { default as ReplyInput } from './ReplyInput';
export { default as CommentTimestamp } from './CommentTimestamp';

// Re-export comment helpers so consumers can do:
//   import { dedupeComments } from '@/components/post-detail';
// alongside the components above.
export { dedupeComments, childrenOf } from '@/lib/comments';

export * from './utils';