// src/app/groups/GroupsClient.jsx
'use client';

import { useEffect, useState } from 'react';
import { useGroups } from '@/contexts/GroupsContext';
import { useAuth } from '@/lib/auth';
import GroupCard from '@/components/groups/GroupCard';
import MyGroupsStrip from '@/components/groups/MyGroupsStrip';

export default function GroupsClient() {
  const { user } = useAuth();
  const { groupsList, hasMoreGroups, loadingGroups, loadGroups, loadMyGroups } = useGroups();

  useEffect(() => {
    loadGroups(true);
    if (user) loadMyGroups();
  }, [user]);

  const loadMore = () => {
    if (!loadingGroups && hasMoreGroups) loadGroups(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)] mb-6">Groups</h1>

      {/* My Groups */}
      {user && <MyGroupsStrip />}

      {/* Trending Groups Grid */}
      <h2 className="text-lg font-head font-bold text-[var(--color-txt)] mb-4">Trending Groups</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupsList.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        {loadingGroups && groupsList.length === 0 && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="group-skel-card rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="h-20 bg-[var(--color-surface)] animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-[var(--color-surface)] animate-pulse rounded" />
                <div className="h-3 w-full bg-[var(--color-surface)] animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-[var(--color-surface)] animate-pulse rounded" />
                <div className="h-8 w-20 bg-[var(--color-surface)] animate-pulse rounded-full mt-2" />
              </div>
            </div>
          ))
        )}
      </div>

      {hasMoreGroups && (
        <button
          onClick={loadMore}
          disabled={loadingGroups}
          className="mt-6 w-full py-3 text-sm font-medium text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition border border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]"
        >
          {loadingGroups ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}