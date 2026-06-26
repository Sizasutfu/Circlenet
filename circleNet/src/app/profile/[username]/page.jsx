// src/app/profile/[username]/page.jsx
import { Suspense } from 'react';
import ProfileClient from '../ProfileClient';
import { apiClient } from '@/lib/api';

// ── Generate metadata for SEO ──
export async function generateMetadata({ params }) {
  const { username } = await params;

  try {
    const res = await apiClient(`/api/users/by-username/${username}`);
    const user = res.data || res;

    return {
      title: `${user.name || user.username} (@${user.username}) | Circlenet`,
      description: user.bio || `View ${user.name || user.username}'s profile on Circlenet.`,
      openGraph: {
        title: `${user.name || user.username} (@${user.username}) | Circlenet`,
        description: user.bio || `View ${user.name || user.username}'s profile on Circlenet.`,
        images: user.picture ? [{ url: user.picture }] : [],
      },
      alternates: {
        canonical: `/profile/${username}`,
      },
    };
  } catch (_) {
    return {
      title: 'Profile | Circlenet',
      description: 'View this profile on Circlenet.',
    };
  }
}

export default async function ProfilePage({ params }) {
  const { username } = await params;

  // Pre-fetch the user data for the client component
  let initialUser = null;
  try {
    const res = await apiClient(`/api/users/by-username/${username}`);
    initialUser = res.data || res;
  } catch (_) {
    // User not found – handle in client
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading profile...</div>}>
      <ProfileClient username={username} initialUser={initialUser} />
    </Suspense>
  );
}