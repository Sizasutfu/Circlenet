'use client';
import Link from 'next/link';
import {fmtNum } from './utils';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder'; 

export default function CreatorProfile({ creator, isFollowing, followerCount, onFollowToggle }) {
  const avatarUrl = resolveMediaUrl(creator.picture);

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6 flex items-start gap-4">
      <Link href={`/profile/${creator.username}`} className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={creator.name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <AvatarPlaceholder size="w-14 h-14" />
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/profile/${creator.username}`} className="font-head font-bold text-[var(--color-txt)] hover:text-[var(--color-accent)] transition">
            {creator.name}
          </Link>
          <span className="text-xs text-[var(--color-txt2)]">@{creator.username}</span>
        </div>
        {creator.bio && <p className="text-sm text-[var(--color-txt2)] mt-1 line-clamp-2">{creator.bio}</p>}
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-txt3)]">
          <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(creator.postCount || 0)}</span> posts</span>
          <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(followerCount)}</span> followers</span>
          <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(creator.followingCount || 0)}</span> following</span>
        </div>
      </div>
      {onFollowToggle && (
        <button
          onClick={onFollowToggle}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex-shrink-0 ${
            isFollowing
              ? 'border border-[var(--color-border)] text-[var(--color-txt2)] hover:bg-[var(--color-accent-bg)]'
              : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'
          }`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}