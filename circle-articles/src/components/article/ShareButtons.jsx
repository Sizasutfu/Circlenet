'use client';
import { useEffect, useState } from 'react';

export default function ShareButtons({ title }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Could not copy link');
    }
  };

  if (!url) return null;

  const encode = encodeURIComponent;

  return (
    <div className="mt-10 p-4 sm:p-5 bg-card border border-border rounded-radius flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
      <span className="text-txt text-sm font-bold">Share this article</span>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encode(url)}`}
          target="_blank"
          rel="noopener"
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-radius-sm text-xs font-bold border border-border bg-surface text-txt2 no-underline inline-flex items-center justify-center gap-1.5 hover:border-accent hover:text-accent hover:bg-accent-bg transition-all"
        >
          Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encode(title)}&url=${encode(url)}`}
          target="_blank"
          rel="noopener"
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-radius-sm text-xs font-bold border border-border bg-surface text-txt2 no-underline inline-flex items-center justify-center gap-1.5 hover:border-accent hover:text-accent hover:bg-accent-bg transition-all"
        >
          Twitter
        </a>
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${encode(url)}&title=${encode(title)}`}
          target="_blank"
          rel="noopener"
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-radius-sm text-xs font-bold border border-border bg-surface text-txt2 no-underline inline-flex items-center justify-center gap-1.5 hover:border-accent hover:text-accent hover:bg-accent-bg transition-all"
        >
          LinkedIn
        </a>
        <button
          onClick={copyToClipboard}
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-radius-sm text-xs font-bold border border-border bg-surface text-txt2 inline-flex items-center justify-center gap-1.5 hover:border-accent hover:text-accent hover:bg-accent-bg transition-all"
        >
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="w-3.5 h-3.5">
            <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}