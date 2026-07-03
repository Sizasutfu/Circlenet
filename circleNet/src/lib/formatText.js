// src/lib/formatText.js

/**
 * Decode HTML entities (e.g., &amp; &lt; &gt; &quot; &#39;)
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  // Use the browser's built-in DOM parser to decode safely
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

/**
 * Convert plain text with links, hashtags, and mentions to safe HTML.
 * - Decodes HTML entities (like &#39; → ')
 * - Escapes HTML to prevent XSS (but NOT apostrophes, they are safe).
 * - Detects http/https URLs and wraps in <a>.
 * - Detects #hashtag and wraps in <a href="/topic/hashtag">.
 * - Detects @username and wraps in <a href="/profile/username">.
 * - Preserves newlines as <br>.
 */
export function formatPostText(text) {
  if (!text) return '';

  // 1. Decode any HTML entities (so &#39; becomes ')
  let html = decodeHtmlEntities(text);

  // 2. Escape HTML to prevent XSS (but don't escape apostrophes)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 3. Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // 4. Convert URLs to clickable links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  html = html.replace(urlRegex, (url) => {
    const display = url.length > 50 ? url.slice(0, 50) + '…' : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[var(--color-accent)] hover:underline">${display}</a>`;
  });

  // 5. Convert #hashtags to topic links
  const hashtagRegex = /(?<!\w)#([\w\u00C0-\u017F]+)/g;
  html = html.replace(hashtagRegex, (match, tag) => {
    return `<a href="/topic/${encodeURIComponent(tag)}" class="text-[var(--color-accent)] hover:underline">#${tag}</a>`;
  });

  // 6. Convert @mentions to profile links
  const mentionRegex = /(?<!\w)@([\w\u00C0-\u017F]+)/g;
  html = html.replace(mentionRegex, (match, username) => {
    return `<a href="/profile/${encodeURIComponent(username)}" class="text-[var(--color-accent)] hover:underline">@${username}</a>`;
  });

  return html;
}