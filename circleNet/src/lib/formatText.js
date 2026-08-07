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
 * - Handles mentions in comments and posts consistently.
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
  // Supports: @username, @user_name, @user-name, @user123
  // Unicode support for international usernames
  const mentionRegex = /(?<!\w)@([\w\u00C0-\u017F\-]+)/g;
  html = html.replace(mentionRegex, (match, username) => {
    return `<a href="/profile/${encodeURIComponent(username)}" class="text-[var(--color-accent)] hover:underline">@${username}</a>`;
  });

  return html;
}

/**
 * Extract all @mentions from text (for notification purposes)
 * Returns an array of unique usernames found in the text
 */
export function extractMentions(text) {
  if (!text) return [];
  
  const mentionRegex = /@([\w\u00C0-\u017F\-]+)/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = new Set();
  
  for (const match of matches) {
    usernames.add(match[1].toLowerCase());
  }
  
  return Array.from(usernames);
}

/**
 * Extract all #hashtags from text
 * Returns an array of unique hashtags found in the text
 */
export function extractHashtags(text) {
  if (!text) return [];
  
  const hashtagRegex = /#([\w\u00C0-\u017F]+)/g;
  const matches = text.matchAll(hashtagRegex);
  const hashtags = new Set();
  
  for (const match of matches) {
    hashtags.add(match[1].toLowerCase());
  }
  
  return Array.from(hashtags);
}

/**
 * Extract all URLs from text
 * Returns an array of URLs found in the text
 */
export function extractUrls(text) {
  if (!text) return [];
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.matchAll(urlRegex);
  const urls = [];
  
  for (const match of matches) {
    urls.push(match[1]);
  }
  
  return urls;
}

/**
 * Truncate text to a maximum length with ellipsis
 * Preserves word boundaries when possible
 */
export function truncateText(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '…';
  }
  
  return truncated + '…';
}

/**
 * Get plain text without any markup (for SEO, meta descriptions, etc.)
 */
export function getPlainText(html) {
  if (!html) return '';
  
  // Remove HTML tags
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

/**
 * Highlight mentions in text (for autocomplete/suggestions)
 * Returns an array of mention objects with start and end positions
 */
export function findMentionPositions(text) {
  if (!text) return [];
  
  const mentionRegex = /@([\w\u00C0-\u017F\-]+)/g;
  const positions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    positions.push({
      username: match[1],
      start: match.index,
      end: match.index + match[0].length,
      fullMatch: match[0]
    });
  }
  
  return positions;
}

/**
 * Check if text contains any mentions
 */
export function hasMentions(text) {
  if (!text) return false;
  return /@[\w\u00C0-\u017F\-]+/.test(text);
}

/**
 * Check if text contains any hashtags
 */
export function hasHashtags(text) {
  if (!text) return false;
  return /#[\w\u00C0-\u017F]+/.test(text);
}

export default {
  formatPostText,
  extractMentions,
  extractHashtags,
  extractUrls,
  truncateText,
  getPlainText,
  findMentionPositions,
  hasMentions,
  hasHashtags
};