// src/components/ui/UserAvatar.jsx
'use client';

import AvatarPlaceholder from './AvatarPlaceholder';

export default function UserAvatar({ user, size = 'w-12 h-12', className = '' }) {
  const avatarUrl = user?.picture;
  const name = user?.name || 'User';
  
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }
  
  return <AvatarPlaceholder size={size} className={className} />;
}