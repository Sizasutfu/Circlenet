'use client';
import Link from 'next/link';
import { resolveMediaUrl, stringToColor, fmtNum } from './utils';

export default function CreatorProfile({ creator, isFollowing, followerCount, onFollowToggle }) {
  const avatarUrl = resolveMediaUrl(creator.picture);
  const initial = creator.name?.charAt(0).toUpperCase() || '?';
  const color = stringToColor(creator.name);

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-6 flex items-start gap-4">
      <Link href={`/profile/${creator.username}`} className="flex-shrink-0">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden"
          style={{ background: avatarUrl ? 'transparent' : color }}
        >
          {avatarUrl ? <img src={avatarUrl} alt={creator.name} className="w-full h-full object-cover" /> : initial}
        </div>
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