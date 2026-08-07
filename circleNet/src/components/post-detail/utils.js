export function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

export function dedupeComments(comments) {
  const seen = new Set();
  return comments.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export function stringToColor(str) {
  if (!str) return '#888';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 55%)`;
}

export function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}

// ─── Mention helper ──────────────────────────────────────────────────
export function extractMentions(text) {
  if (!text) return [];
  const mentionRegex = /@([a-zA-Z0-9_\-]{3,25})/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = [];
  for (const match of matches) {
    const username = match[1].toLowerCase();
    if (!usernames.includes(username)) {
      usernames.push(username);
    }
  }
  return usernames;
}