// src/app/groups/[id]/GroupDetailClient.jsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useGroups } from '@/contexts/GroupsContext';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import PostCard from '@/components/ui/PostCard';

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

const GROUP_GRADIENTS = [
  'linear-gradient(160deg,#16151f 0%,#1e1c2a 100%)',
  'linear-gradient(160deg,#131a1e 0%,#192025 100%)',
  'linear-gradient(160deg,#1e1518 0%,#251c20 100%)',
  'linear-gradient(160deg,#1a1710 0%,#221e14 100%)',
  'linear-gradient(160deg,#121620 0%,#181d28 100%)',
  'linear-gradient(160deg,#141a18 0%,#1b2220 100%)',
];

function groupGradient(topic) {
  let h = 0;
  for (let i = 0; i < (topic || '').length; i++)
    h = (h * 31 + topic.charCodeAt(i)) & 0xffff;
  return GROUP_GRADIENTS[h % GROUP_GRADIENTS.length];
}

export default function GroupDetailClient({ params }) {
  const { user } = useAuth();
  const router = useRouter();
  const {
    currentGroup,
    groupFeed,
    hasMoreGroupFeed,
    loadingGroupFeed,
    loadGroupDetail,
    loadGroupFeed,
    joinGroup,
    leaveGroup,
    postToGroup,
  } = useGroups();

  const [activeTab, setActiveTab] = useState('feed');
  const [composerText, setComposerText] = useState('');
  const [composerImage, setComposerImage] = useState(null);
  const [composerVideo, setComposerVideo] = useState(null);
  const [composerImagePreview, setComposerImagePreview] = useState(null);
  const [composerVideoPreview, setComposerVideoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadMoreRef = useRef(null);
  const [groupId, setGroupId] = useState(null);
  const initialFetchDone = useRef(false);

  // ── Resolve groupId from params ──
  useEffect(() => {
    const resolveParams = async () => {
      if (!params) return;
      try {
        const resolved = await params;
        setGroupId(resolved.id);
      } catch (err) {
        setError('Could not read group ID.');
        setLoading(false);
      }
    };
    resolveParams();
  }, [params]);

  // ── Load group data (only once) ──
  useEffect(() => {
    if (!groupId) return;
    if (initialFetchDone.current) return;
    initialFetchDone.current = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadGroupDetail(groupId);
        await loadGroupFeed(groupId, true);
      } catch (err) {
        console.error('Failed to load group:', err);
        setError(err.message || 'Failed to load group.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [groupId]);

  // ── Infinite scroll observer ──
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreGroupFeed && !loadingGroupFeed) {
          loadGroupFeed(groupId, false);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreGroupFeed, loadingGroupFeed, groupId, loadGroupFeed]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading group…</p>
      </div>
    );
  }

  // ── Error state ──
  if (error || !currentGroup) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <p className="text-[var(--color-rose)]">{error || 'Group not found.'}</p>
        <button
          onClick={() => router.push('/groups')}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Back to Groups
        </button>
      </div>
    );
  }

  const grad = groupGradient(currentGroup.topic);
  const isMember = currentGroup.isMember || false;
  const coverHtml = currentGroup.coverImage ? (
    <img src={currentGroup.coverImage} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center" style={{ background: grad }}>
      <svg width="48" height="48" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    </div>
  );

  // ── Join/Leave ──
  const handleJoinToggle = async () => {
    if (!user) { router.push('/login'); return; }
    setIsJoining(true);
    try {
      if (isMember) {
        await leaveGroup(groupId);
      } else {
        await joinGroup(groupId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  // ── Post composer ──
  const handlePost = async () => {
    if (!user || !isMember) return;
    if (!composerText.trim() && !composerImage && !composerVideo) return;
    setSubmitting(true);
    try {
      await postToGroup(groupId, composerText, composerImage, composerVideo);
      setComposerText('');
      setComposerImage(null);
      setComposerVideo(null);
      setComposerImagePreview(null);
      setComposerVideoPreview(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setComposerImage(file);
    setComposerVideo(null);
    setComposerVideoPreview(null);
    const reader = new FileReader();
    reader.onload = (ev) => setComposerImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setComposerVideo(file);
    setComposerImage(null);
    setComposerImagePreview(null);
    setComposerVideoPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setComposerImage(null);
    setComposerVideo(null);
    setComposerImagePreview(null);
    setComposerVideoPreview(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="relative h-48 md:h-56 rounded-2xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)]">
        {coverHtml}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-head font-bold text-white">
              {currentGroup.displayName || '#' + currentGroup.topic}
            </h1>
            <p className="text-sm text-white/80">{currentGroup.description || ''}</p>
            <div className="flex gap-4 mt-2 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                {fmtNum(currentGroup.memberCount)} members
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M5.636 5.636a9 9 0 000 12.728M8.464 8.464a5 5 0 000 7.072M12 13a1 1 0 100-2 1 1 0 000 2z"/>
                </svg>
                {fmtNum(currentGroup.postCount)} posts / 7d
              </span>
            </div>
          </div>
          {user && (
            <button
              onClick={handleJoinToggle}
              disabled={isJoining}
              className={`px-5 py-2 rounded-full text-sm font-bold transition ${isMember ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-h)]'}`}
            >
              {isJoining ? '…' : (isMember ? '✓ Joined' : 'Join')}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[var(--color-border)] mt-4">
        {['feed', 'about'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium transition relative ${activeTab === tab ? 'text-[var(--color-accent)]' : 'text-[var(--color-txt2)] hover:text-[var(--color-txt)]'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[var(--color-accent)] rounded-full" />}
          </button>
        ))}
      </div>

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="mt-4">
          {/* ── Composer – always visible ── */}
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center text-sm font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                {isMember ? (
                  <>
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder="What's on your mind?"
                      className="w-full bg-transparent border-none outline-none resize-none text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)]"
                      rows={2}
                    />
                    {(composerImagePreview || composerVideoPreview) && (
                      <div className="relative mt-2 inline-block">
                        {composerImagePreview && (
                          <img src={composerImagePreview} alt="Preview" className="max-h-48 rounded-lg border border-[var(--color-border)]" />
                        )}
                        {composerVideoPreview && (
                          <video src={composerVideoPreview} className="max-h-48 rounded-lg border border-[var(--color-border)]" controls />
                        )}
                        <button
                          onClick={removeMedia}
                          className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)]">
                      <div className="flex gap-2">
                        <label className="cursor-pointer text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                        </label>
                        <label className="cursor-pointer text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polygon points="23 7 16 12 23 17 23 7" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                          <input type="file" className="hidden" accept="video/*" onChange={handleVideoSelect} />
                        </label>
                      </div>
                      <button
                        onClick={handlePost}
                        disabled={submitting || (!composerText.trim() && !composerImage && !composerVideo)}
                        className="px-4 py-1.5 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
                      >
                        {submitting ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-3 text-center text-[var(--color-txt2)]">
                    <p className="text-sm">Join this group to start posting</p>
                    <button
                      onClick={handleJoinToggle}
                      disabled={isJoining}
                      className="mt-2 px-4 py-1.5 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition"
                    >
                      {isJoining ? '…' : 'Join Now'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {groupFeed.length === 0 ? (
              <p className="text-center text-[var(--color-txt2)] py-8">No posts yet in this group.</p>
            ) : (
              groupFeed.map((post) => <PostCard key={post.id} post={post} />)
            )}
            {hasMoreGroupFeed && (
              <div ref={loadMoreRef} className="text-center py-4 text-[var(--color-txt2)]">
                {loadingGroupFeed ? 'Loading more…' : 'Load more'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="mt-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
          <div className="text-sm text-[var(--color-txt)]">{currentGroup.description || 'No description provided.'}</div>
          <div className="text-xs text-[var(--color-txt2)] flex flex-wrap gap-4">
            <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(currentGroup.memberCount)}</span> members</span>
            <span><span className="font-bold text-[var(--color-txt)]">{fmtNum(currentGroup.postCount)}</span> posts in last 7 days</span>
            <span>Topic: <span className="text-[var(--color-accent)] font-semibold">#{currentGroup.topic}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}