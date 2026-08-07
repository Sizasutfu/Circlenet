// types/index.ts
export interface User {
  id: number;
  name: string;
  username: string;
  email?: string;
  bio?: string;
  picture?: string | null;
  coverImage?: string | null;
  location?: string;
  website?: string;
  joined?: string;
  school?: string;
  occupation?: string;
  gender?: string;
  phone?: string;
  dateOfBirth?: string;
  postCount?: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  mutualFollowers?: User[];
  verified?: boolean | number;
}

export interface Post {
  id: number;
  content: string;
  userId: number;
  user?: User;
  likes?: number[];
  repostCount?: number;
  commentCount?: number;
  createdAt: string;
  images?: string[];
  video?: string | null;
  repostId?: number | null;
  repost?: Post | null;
  quoteId?: number | null;
  quote?: Post | null;
}

export interface ProfileCacheData {
  profile: User;
  posts: Post[];
  page: number;
  hasMore: boolean;
}

export interface ToastProps {
  message: string;
  type: 'success' | 'error';
}