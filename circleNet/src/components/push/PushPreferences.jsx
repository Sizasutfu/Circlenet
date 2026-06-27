// src/components/push/PushPreferences.jsx
'use client';

import { usePush } from '@/contexts/PushContext';

const PREF_ITEMS = [
  { key: 'likes', label: 'Likes on my posts' },
  { key: 'comments', label: 'Comments on my posts' },
  { key: 'reposts', label: 'Reposts of my posts' },
  { key: 'new_post', label: 'New posts from people I follow' },
  { key: 'profile_pic', label: 'Profile picture updates' },
  { key: 'follows', label: 'New followers' },
  { key: 'mentions', label: 'Mentions' },
];

export default function PushPreferences() {
  const { isSubscribed, preferences, updatePreference } = usePush();

  if (!isSubscribed) {
    return (
      <div className="text-sm text-[var(--color-txt2)]">
        Enable push notifications above to manage preferences.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {PREF_ITEMS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-3 text-sm text-[var(--color-txt2)]">
          <input
            type="checkbox"
            checked={preferences[key] !== false}
            onChange={(e) => updatePreference(key, e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          {label}
        </label>
      ))}
    </div>
  );
}