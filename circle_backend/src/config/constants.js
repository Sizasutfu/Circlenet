// ============================================================
//  config/constants.js  —  Feed Algorithm v2
//
//  Design philosophy:
//    • Engagement signals form a BASE score (log-scaled to avoid
//      viral posts dominating forever).
//    • Affinity and topic are MULTIPLIERS (0.5–2.0 range) so
//      they modulate rank without being additive runaway values.
//    • Recency uses exponential half-life decay, not division.
//    • Exploration posts bypass scoring and are injected at
//      fixed slots to guarantee variety.
//    • All weights are grouped and commented so tuning is easy.
//    • NEW: user‑attribute similarity boosts posts from authors
//      who share location, school, occupation, gender, or age.
//    • NEW: DM affinity boosts posts from users you message.
//    • NEW: Media quality, content length, mutual follows,
//      group affinity, and session activity signals.
//    • NEW: Mention signals — posts where the viewer is mentioned
//      get a significant boost.
// ============================================================

module.exports = {

  // ── Engagement base weights ─────────────────────────────
  // Applied to log1p(count) so viral posts don't dominate.
  WEIGHT_LIKE:    4.0,   // moderate — likes are cheap
  WEIGHT_COMMENT: 9.0,   // comments = real intent
  WEIGHT_REPOST:  6.0,   // strong endorsement
  WEIGHT_VIEW:    0.3,   // high volume — keep small
  WEIGHT_DWELL:   5.0,   // seconds of reading time (if tracked)
  WEIGHT_MENTION: 12.0,  // mentions = personal relevance (HIGHEST)

  // ── Negative signal weights ──────────────────────────────
  // Subtracted from base score before multipliers are applied.
  PENALTY_SKIP:        8.0,   // user scrolled past without pause
  PENALTY_SHORT_VIEW:  4.0,   // viewed < SHORT_VIEW_THRESHOLD seconds
  SHORT_VIEW_THRESHOLD: 2,    // seconds — below this = short view

  // ── Affinity multiplier (author ↔ viewer history) ────────
  // Final multiplier = clamp(1.0 + affinityRaw, MIN, MAX)
  // affinityRaw is built from past likes/comments/reposts on
  // this author's posts, each weighted below.
  AFFINITY_LIKE_WEIGHT:    0.05,   // per past like on this author
  AFFINITY_COMMENT_WEIGHT: 0.12,   // per past comment
  AFFINITY_REPOST_WEIGHT:  0.08,   // per past repost
  AFFINITY_FOLLOW_BONUS:   0.40,   // flat bonus if you follow this author
  AFFINITY_MULTIPLIER_MIN: 0.80,   // floor  — unfamiliar author still surfaces
  AFFINITY_MULTIPLIER_MAX: 2.00,   // ceiling — cap so one author doesn't monopolise

  // ── DM affinity multiplier ───────────────────────────────
  // Posts from users you've exchanged DMs with get a boost.
  // The score is computed based on message count and recency.
  // Score = clamp(0.1, recency_weight/10 + countBonus, 2.0)
  // Final multiplier = 1.0 + (dmScore / DM_AFFINITY_SCALE)
  DM_AFFINITY_SCALE:       5.0,   // higher = smaller boost (1 + score/5)

  // ── Topic interest multiplier ────────────────────────────
  // topicScore from user_topic_preferences, normalised to [0,1]
  // before being turned into a multiplier.
  // Final multiplier = 1.0 + (normalisedTopicScore * TOPIC_WEIGHT)
  TOPIC_WEIGHT:           0.60,   // max topic lift = +60% of base
  TOPIC_SCORE_NORMALISE:  20.0,   // score value treated as "1.0" (tune to your data)
  TOPIC_MULTIPLIER_MAX:   1.60,   // ceiling — topic can't more than double a post

  // ── Recency decay ────────────────────────────────────────
  // Uses exponential decay: e^(-hoursOld / RECENCY_HALFLIFE_HOURS)
  // At hoursOld == RECENCY_HALFLIFE_HOURS → decay = 0.5
  // A new post (0 h) = 1.0, a 48h post with 24h halflife = 0.25
  RECENCY_HALFLIFE_HOURS:  24,    // tune down for faster-moving apps
  RECENCY_WEIGHT:          50,    // multiplied by decay value → recency score

  // ── Newness boost (brand-new posts) ─────────────────────
  // Posts under NEWNESS_HOURS old get a flat additive boost
  // so they can surface even before they accumulate engagement.
  NEWNESS_HOURS:           2,     // window for the boost
  NEWNESS_BOOST:           20,    // raw points added to base

  // ── Seen-post penalty ────────────────────────────────────
  // Score is multiplied by this value for already-seen posts.
  // 0.0 = hide, 1.0 = no penalty.  0.25 means strong pushdown.
  SEEN_PENALTY:            0.25,

  // ── Diversity constraints ────────────────────────────────
  MAX_PER_AUTHOR:          3,     // max posts per creator per page
  MAX_CONSECUTIVE_TOPIC:   2,     // max same-topic posts in a row

  // ── Exploration injection ────────────────────────────────
  // One exploration post is injected every N positions.
  // e.g. 5 → positions 5, 10, 15 … ≈ 20% of a 20-item page.
  EXPLORE_EVERY_N:         5,     // inject at every 5th slot
  EXPLORE_MAX_AGE_HOURS:   72,    // only surface posts younger than this

  // ── Feed pipeline ────────────────────────────────────────
  FEED_PAGE_SIZE:              20,
  FEED_CANDIDATE_MULTIPLIER:   6,   // candidates = page_size × this

  // ── User‑attribute similarity ────────────────────────────
  // Each match contributes a weight; the total is added to 1.0.
  // The final multiplier is capped at SIMILARITY_MAX_MULTIPLIER.
  SIMILARITY_LOCATION_WEIGHT:   0.30,   // same location (string match)
  SIMILARITY_SCHOOL_WEIGHT:     0.25,   // same school
  SIMILARITY_OCCUPATION_WEIGHT: 0.15,   // same occupation
  SIMILARITY_GENDER_WEIGHT:     0.10,   // same gender
  SIMILARITY_AGE_WEIGHT:        0.20,   // age similarity (decay over years)
  AGE_SIMILARITY_DECAY:         5,      // years: diff ≥ 5 → similarity = 0
  SIMILARITY_MAX_MULTIPLIER:    2.00,   // cap to avoid over‑boost

  // ── Collaborative filtering ──────────────────────────────
  // Boost posts similar to those the user has engaged with.
  COLLABORATIVE_SCALE:       2.0,   // multiplier = 1.0 + (avgSim * scale)
  COLLABORATIVE_MAX_BOOST:   2.0,   // cap multiplier at this value
  MAX_ENGAGED_POSTS:         200,   // limit recent interactions for performance

  // ── Content‑type preference ───────────────────────────────
  CONTENT_TYPE_BOOST_MIN: 0.8,
  CONTENT_TYPE_BOOST_MAX: 1.2,

  // ── Media Quality Boost ──────────────────────────────────
  // Posts with media get a boost; plain text gets a slight penalty.
  MEDIA_BOOST_VIDEO:  1.15,   // video content
  MEDIA_BOOST_IMAGE:  1.05,   // image content
  MEDIA_BOOST_TEXT:   0.90,   // plain text (penalty)

  // ── Content Length Boost ─────────────────────────────────
  // Longer, more substantive content gets a boost.
  LENGTH_LONG_WORDS:    100,   // >100 words = "long"
  LENGTH_MEDIUM_WORDS:  50,    // 50-100 words = "medium"
  LENGTH_BOOST_LONG:    1.15,  // boost for long posts
  LENGTH_BOOST_MEDIUM:  1.05,  // boost for medium posts
  LENGTH_BOOST_SHORT:   0.85,  // penalty for very short posts (<5 words)

  // ── Mutual Follow Boost ──────────────────────────────────
  // Posts from users who follow each other get a boost.
  MUTUAL_FOLLOW_BOOST:  1.30,  // strong social bond signal

  // ── Group Affinity Boost ─────────────────────────────────
  // Posts from groups the user has joined get a boost.
  GROUP_AFFINITY_BOOST: 1.20,  // user is a member of the group

  // ── Session Activity Boost ──────────────────────────────
  // Boosts content similar to what the user engaged with in this session.
  SESSION_SIMILAR_BOOST:    1.05,   // per similar post in session (capped)
  SESSION_MAX_BOOST:        1.30,   // maximum session boost

  // ── Author Engagement Velocity ──────────────────────────
  // Boosts posts that are getting engagement quickly after publishing.
  VELOCITY_BOOST_MAX:       1.50,   // maximum velocity boost
  VELOCITY_LIKES_PER_HOUR:  10,     // scale factor for likes/hour

  // ── Mention Boost ────────────────────────────────────────
  // Posts where the viewer is mentioned get a significant boost.
  MENTION_BOOST_MULTIPLIER:  3.00,  // 3x boost for mentioned posts
  MENTION_REPLY_BOOST:       2.50,  // 2.5x boost for mentions in replies

  // ── Repost Boost ────────────────────────────────────────────
  // Posts that are reposted by users you follow get a boost
  REPOST_FROM_FOLLOWED_BOOST:  1.2,   // 20% boost for reposts from followed users
  REPOST_FOLLOW_BOTH_BOOST:    1.4,   // 40% boost if you follow both reposter and original author

  // ── Niche-based recommendations ──────────────────────────
// NEW: Boost posts based on user's detected niches
NICHE_BOOST_WEIGHT: 0.5,          // Max boost = 50% of niche score
NICHE_MULTIPLIER_MAX: 1.5,        // Cap niche multiplier
NICHE_MIN_SCORE: 0.1,             // Minimum niche score to consider
NICHE_MAX_RECOMMENDATIONS: 5,     // Max niches to track per user


// ── Similar Creator Recommendations ──────────────────────
// NEW: Boost posts from creators who create similar content
SIMILAR_CREATOR_BOOST: 1.2,    // 20% boost for similar creators
MAX_SIMILAR_CREATORS: 3,       // Max similar creators to recommend

  // ── Score debug flag ─────────────────────────────────────
  // Set to true to attach _scoreDebug to each post object.
  DEBUG_SCORES:  false,

  // ════════════════════════════════════════════════════════════
  //  NEW: GLOBAL MULTIPLIER CAP (Issue 1 fix)
  // ════════════════════════════════════════════════════════════
  // Prevents score explosion from 15+ multipliers compounding.
  // Any combined multiplier exceeding this cap is clamped.
  GLOBAL_MULTIPLIER_CAP: 4.0,
};