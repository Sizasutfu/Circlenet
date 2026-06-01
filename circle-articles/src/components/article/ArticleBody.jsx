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
      className="art-body"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: extractBodyContent(content) }}
    />
  );
}