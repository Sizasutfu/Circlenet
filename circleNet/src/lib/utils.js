// src/lib/utils.js

// ── Linkify hashtags, mentions, and URLs ──
export function linkify(html) {
  if (!html) return html;

  // 1. Linkify http/https URLs
  html = html.replace(
    /(?:https?:\/\/)[-a-zA-Z0-9@:%._+~#=]{1,256}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`
  );

  // 2. Linkify www. links
  html = html.replace(
    /(?<![\w\/:.])www\.[a-zA-Z0-9-]{1,256}\.[a-zA-Z]{2,}(?::[0-9]{1,5})?(?:[\/][-a-zA-Z0-9()@:%_+.~#?&\/=]*)?/g,
    (url) => `<a href="https://${url}" target="_blank" rel="noopener noreferrer" class="post-link" onclick="event.stopPropagation()">${url}</a>`
  );

  // 3. @mentions
  html = html.replace(
    /(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]{1,30})/g,
    (match, username) =>
      `<a class="mention" href="/profile?username=${encodeURIComponent(username)}" onclick="event.stopPropagation()">${match}</a>`
  );

  // 4. #hashtags
  html = html.replace(
    /(?<!&)#([a-zA-Z][a-zA-Z0-9_]*)/g,
    (match, tag) =>
      `<a class="hashtag" href="/topic/${encodeURIComponent(tag.toLowerCase())}" onclick="event.stopPropagation()">${match}</a>`
  );

  return html;
}