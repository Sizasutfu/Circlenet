// ============================================================
//  feed/feedDiversity.js
//
//  Applies diversity constraints to a sorted list of posts
//  AFTER scoring but BEFORE the final page slice.
//
//  Rules enforced:
//    1. MAX_PER_AUTHOR  — no creator appears more than N times
//    2. MAX_CONSECUTIVE_TOPIC — same topic can't run N+ in a row
//
//  Posts that violate a rule are pushed to an overflow list and
//  appended at the end, so no post is dropped entirely — just
//  reordered.  This keeps hasMore logic intact.
// ============================================================

const { MAX_PER_AUTHOR, MAX_CONSECUTIVE_TOPIC } = require('../config/constants');

/**
 * Re-order `sorted` (already score-sorted) to enforce diversity.
 *
 * @param  {Object[]} sorted  - Posts sorted by finalScore DESC
 * @returns {Object[]}          Diversity-filtered order (same length)
 */
function applyDiversity(sorted) {
  if (!sorted.length) return sorted;

  const authorCount = {};          // authorId → how many times placed
  const overflow = [];             // posts deferred due to rule violations
  const result = [];

  let lastTopics = [];             // topics of the last placed post
  let consecutiveTopic = 0;        // current same-topic streak length

  // ── First pass: try to place each post ─────────────────────
  for (const post of sorted) {
    const authorId = post.userId || post.authorId;
    const postTopics = post._topics || [];

    // ── Author cap check ────────────────────────────────────
    const authorSoFar = authorCount[authorId] || 0;
    if (authorSoFar >= MAX_PER_AUTHOR) {
      overflow.push(post);
      continue;
    }

    // ── Topic-streak check ──────────────────────────────────
    // "same topic" = post shares at least one topic with the last post
    const overlaps = postTopics.some(t => lastTopics.includes(t));
    if (overlaps && consecutiveTopic >= MAX_CONSECUTIVE_TOPIC) {
      overflow.push(post);
      continue;
    }

    // ── Accept post ─────────────────────────────────────────
    result.push(post);
    authorCount[authorId] = authorSoFar + 1;

    // Update topic streak
    if (overlaps && postTopics.length > 0) {
      consecutiveTopic++;
    } else {
      consecutiveTopic = postTopics.length > 0 ? 1 : 0;
    }
    lastTopics = postTopics;
  }

  // ── Second pass: try to place overflow posts ──────────────
  // Reset topic streak tracking for overflow placement
  let overflowResult = [];
  let overflowTopics = [];
  let overflowConsecutive = 0;

  for (const post of overflow) {
    const authorId = post.userId || post.authorId;
    const postTopics = post._topics || [];

    // Check author cap (shouldn't exceed MAX_PER_AUTHOR in overflow)
    const authorSoFar = authorCount[authorId] || 0;
    if (authorSoFar >= MAX_PER_AUTHOR) {
      // Already at cap; push to end
      overflowResult.push(post);
      continue;
    }

    // Check topic streak in overflow
    const overlaps = postTopics.some(t => overflowTopics.includes(t));
    if (overlaps && overflowConsecutive >= MAX_CONSECUTIVE_TOPIC) {
      overflowResult.push(post);
      continue;
    }

    // We can place this post now
    overflowResult.push(post);
    authorCount[authorId] = (authorCount[authorId] || 0) + 1;

    if (overlaps && postTopics.length > 0) {
      overflowConsecutive++;
    } else {
      overflowConsecutive = postTopics.length > 0 ? 1 : 0;
    }
    overflowTopics = postTopics;
  }

  // ── Return combined result ─────────────────────────────────
  return [...result, ...overflowResult];
}

module.exports = { applyDiversity };