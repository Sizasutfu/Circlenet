// src/components/dm/DmNewModal.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useDm } from '@/contexts/DmContext';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export default function DmNewModal() {
  const { openConversation } = useDm();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient(`/api/users?search=${encodeURIComponent(search)}&limit=8`);
        const users = Array.isArray(res.data) ? res.data : [];
        setResults(users.filter((u) => u.id !== user?.id));
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, user]);

  const handlePick = (u) => {
    closeModal();
    openConversation(u.id); // or start new conversation via API
  };

  const closeModal = () => {
    document.getElementById('dm-new-modal').classList.remove('open');
  };

  return (
    <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/60 backdrop-blur-sm" id="dm-new-modal">
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--radius-radius)] w-[380px] max-w-[94vw] shadow-[var(--color-shadow)] animate-fadeUp overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-head text-base font-extrabold flex-1">New Message</h3>
          <button onClick={closeModal} className="text-2xl text-[var(--color-txt2)] hover:text-[var(--color-txt)] bg-none border-none cursor-pointer">×</button>
        </div>
        <div className="p-4 pb-2">
          <input
            type="text"
            placeholder="Search people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-full px-4 py-2.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none transition"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {loading ? (
            <div className="text-center py-7 px-4 text-[var(--color-txt3)]">Searching…</div>
          ) : results.length === 0 ? (
            <div className="text-center py-7 px-4 text-[var(--color-txt3)] text-sm">
              {search.trim() ? 'No users found' : 'Search for someone to message'}
            </div>
          ) : (
            results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--color-accent-bg)] transition"
                onClick={() => handlePick(u)}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{
                    background: u.picture ? 'transparent' : stringToColor(u.name),
                    overflow: 'hidden',
                  }}
                >
                  {u.picture ? (
                    <img src={u.picture} alt={u.name.charAt(0)} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    u.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--color-txt)]">{u.name}</div>
                  <div className="text-xs text-[var(--color-txt2)] truncate">{u.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}