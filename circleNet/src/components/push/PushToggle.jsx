// src/components/push/PushToggle.jsx
'use client';

import { usePush } from '@/contexts/PushContext';
import { useState } from 'react';

export default function PushToggle() {
  const { isSupported, isSubscribed, permission, loading, error, togglePush } = usePush();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (enabled) => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      await togglePush(enabled);
    } catch (err) {
      alert('Failed to toggle push: ' + err.message);
    } finally {
      setIsToggling(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--color-txt2)]">Loading push status…</div>;
  }

  if (!isSupported) {
    return <div className="text-sm text-[var(--color-txt2)]">Push notifications are not supported in this browser.</div>;
  }

  if (permission === 'denied') {
    return (
      <div className="text-sm text-[var(--color-rose)]">
        <span>🔴 Notifications blocked</span>
        <span className="ml-2 text-[var(--color-txt2)]">Please allow in your browser settings.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-[var(--color-rose)]">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => handleToggle(!isSubscribed)}
        disabled={isToggling}
        className={`relative w-11 h-6 rounded-full transition-colors ${isSubscribed ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border2)]'}`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${isSubscribed ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
      <span className="text-sm text-[var(--color-txt2)]">
        {isSubscribed ? 'Notifications are active' : 'Enable push notifications'}
      </span>
    </div>
  );
}