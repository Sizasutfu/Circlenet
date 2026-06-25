// src/app/profile/page.jsx
import { Suspense } from 'react';
import ProfileClient from './ProfileClient';

export const metadata = {
  title: 'Profile | Circlenet',
  description: 'View and manage your Circlenet profile',
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading profile...</div>}>
      <ProfileClient />
    </Suspense>
  );
}