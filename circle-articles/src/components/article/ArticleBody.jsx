'use client';

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
  return (
    <div
  className="text-base leading-relaxed text-txt2 break-words [&_p]:mb-5 [&_h1]:text-txt [&_h2]:text-txt [&_h3]:text-txt [&_h1]:mt-6 [&_h2]:mt-5 [&_h3]:mt-4 [&_h1]:mb-3 [&_h2]:mb-2 [&_h3]:mb-2 [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:rounded-radius-sm [&_pre]:overflow-x-auto [&_pre]:my-4 [&_code]:bg-card [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm"
  suppressHydrationWarning
  dangerouslySetInnerHTML={{ __html: extractBodyContent(content) }}
/>
  );
}