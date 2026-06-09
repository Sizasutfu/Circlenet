'use client';
import React from 'react';

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="animate-pulse">
        <div className="w-full h-56 bg-surface rounded-radius mb-6 border border-border" />

        <div className="flex gap-2 mb-4">
          <div className="h-6 w-24 bg-card rounded-full" />
          <div className="h-6 w-16 bg-card rounded-full" />
        </div>

        <div className="h-10 w-3/4 bg-card rounded-md mb-6" />

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-card" />
          <div className="space-y-1">
            <div className="h-4 w-40 bg-card rounded-md" />
            <div className="h-3 w-28 bg-card rounded-md" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="h-4 w-full bg-card rounded-md" />
          <div className="h-4 w-full bg-card rounded-md" />
          <div className="h-4 w-5/6 bg-card rounded-md" />
          <div className="h-4 w-4/6 bg-card rounded-md" />
          <div className="h-4 w-3/4 bg-card rounded-md" />
        </div>

        <div className="mt-8 space-y-3">
          <div className="h-3 w-32 bg-card rounded-md" />
          <div className="h-3 w-28 bg-card rounded-md" />
        </div>
      </div>
    </main>
  );
}
