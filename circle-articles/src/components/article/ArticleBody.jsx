'use client';

import { useEffect, useRef } from 'react';

function extractBodyContent(html) {
  if (!html) return '<p>No content available</p>';

  // Normalize CRLF to LF so server and client produce identical strings
  const normalized = html.replace(/\r\n/g, '\n');

  // If it's a full HTML document, extract just the body content
  const bodyMatch = normalized.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) return bodyMatch[1];

  return normalized;
}

export default function ArticleBody({ content }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleClick(e) {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;

      const text = btn.getAttribute('data-prompt');
      if (!text) return;

      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1500);
      });
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="text-base leading-relaxed text-txt2 break-words [&_p]:mb-5 [&_h1]:text-txt [&_h2]:text-txt [&_h3]:text-txt [&_h1]:mt-6 [&_h2]:mt-5 [&_h3]:mt-4 [&_h1]:mb-3 [&_h2]:mb-2 [&_h3]:mb-2 [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:rounded-radius-sm [&_pre]:overflow-x-auto [&_pre]:my-4 [&_code]:bg-card [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm [&_.prompt-block]:relative [&_.prompt-block_pre]:pr-20 [&_.copy-btn]:absolute [&_.copy-btn]:top-2 [&_.copy-btn]:right-2 [&_.copy-btn]:text-xs [&_.copy-btn]:px-2.5 [&_.copy-btn]:py-1 [&_.copy-btn]:rounded-md [&_.copy-btn]:border [&_.copy-btn]:border-border [&_.copy-btn]:bg-surface [&_.copy-btn]:text-txt2 [&_.copy-btn]:cursor-pointer [&_.copy-btn.copied]:bg-green-900 [&_.copy-btn.copied]:text-green-200"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: extractBodyContent(content) }}
    />
  );
}