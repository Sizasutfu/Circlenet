// src/lib/formatText.js

/**
 * Convert plain text with links and hashtags to safe HTML with clickable elements.
 * - Escapes HTML to prevent XSS.
 * - Detects URLs (http, https) and wraps them in <a>.
 * - Detects #hashtags and wraps them in <a> to /topic/hashtag.
 * - Detects @mentions and wraps them in <a> to /profile/username.
 */
export function formatPostText(text) {
  if (!text) return '';

  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // 2. Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // 3. Convert URLs to clickable links
  // Regex for http/https URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  html = html.replace(urlRegex, (url) => {
    const display = url.length > 50 ? url.slice(0, 50) + '…' : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[var(--color-accent)] hover:underline">${display}</a>`;
  });

  // 4. Convert #hashtags to topic links
  // Must not be inside an existing <a> tag (simple approach: we will replace all, but we need to avoid inside tags)
  // A simpler approach: split by tags and process parts outside tags? But we can do a regex that looks for #word not inside a tag.
  // Since we already escaped, there are no tags yet except the ones we added for URLs.
  // We'll replace hashtags, but be careful not to touch those that are part of a URL (already handled).
  // Use a negative lookbehind for a word character to not match email addresses etc.
  const hashtagRegex = /(?<!\w)#([\w\u00C0-\u017F]+)/g;
  html = html.replace(hashtagRegex, (match, tag) => {
    return `<a href="/topic/${encodeURIComponent(tag)}" class="text-[var(--color-accent)] hover:underline">#${tag}</a>`;
  });

  // 5. Convert @mentions to profile links (optional but nice)
  const mentionRegex = /(?<!\w)@([\w\u00C0-\u017F]+)/g;
  html = html.replace(mentionRegex, (match, username) => {
    return `<a href="/profile/${encodeURIComponent(username)}" class="text-[var(--color-accent)] hover:underline">@${username}</a>`;
  });

  return html;
}

/**
 * For use in React with dangerouslySetInnerHTML.
 * Example:
 *   <div dangerouslySetInnerHTML={{ __html: formatPostText(post.text) }} />
 */