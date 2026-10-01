/**
 * Dedupe a flat list of comments by id, preserving order.
 * Keeps the newest copy of each comment (first occurrence wins).
 */
export function dedupeComments(comments = []) {
  if (!Array.isArray(comments)) return [];
  const seen = new Set();
  const out = [];
  for (const c of comments) {
    if (!c || c.id == null) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

/**
 * Given a flat list, return comments whose parentId === parentId (or null/undefined
 * for top-level). Handles both camelCase and snake_case from the API.
 */
export function childrenOf(comments, parentId = null) {
  return comments.filter((c) => {
    const p = c.parentId ?? c.parent_id ?? null;
    return parentId == null ? !p : p === parentId;
  });
}