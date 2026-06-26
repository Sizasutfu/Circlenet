// src/components/groups/MyGroupsStrip.jsx
'use client';

import { useGroups } from '@/contexts/GroupsContext';
import Link from 'next/link';

function groupGradient(topic) {
  const gradients = [
    'linear-gradient(160deg,#16151f 0%,#1e1c2a 100%)',
    'linear-gradient(160deg,#131a1e 0%,#192025 100%)',
    'linear-gradient(160deg,#1e1518 0%,#251c20 100%)',
    'linear-gradient(160deg,#1a1710 0%,#221e14 100%)',
    'linear-gradient(160deg,#121620 0%,#181d28 100%)',
    'linear-gradient(160deg,#141a18 0%,#1b2220 100%)',
  ];
  let h = 0;
  for (let i = 0; i < (topic || '').length; i++)
    h = (h * 31 + topic.charCodeAt(i)) & 0xffff;
  return gradients[h % gradients.length];
}

export default function MyGroupsStrip() {
  const { myGroups } = useGroups();

  if (!myGroups || myGroups.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-[var(--color-txt2)] uppercase tracking-wide mb-2">Your Groups</h2>
      <div className="flex flex-wrap gap-2">
        {myGroups.map((g) => (
          <Link
            key={g.id}
            href={`/groups/${g.id}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-surface)] transition"
          >
            <div
              className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0"
              style={{ background: groupGradient(g.topic) }}
            >
              {g.coverImage && (
                <img src={g.coverImage} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <span className="text-sm font-medium text-[var(--color-txt)] truncate max-w-[120px]">
              {g.displayName || '#' + g.topic}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}