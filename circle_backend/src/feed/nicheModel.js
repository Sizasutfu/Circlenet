// ============================================================
//  feed/nicheModel.js
//
//  Detects and scores user niches based on:
//    - Topics they engage with
//    - Creators they follow
//    - Content types they prefer
//    - Groups they join
//
//  A "niche" is a cluster of related topics, creators, and
//  content patterns that define a user's primary interests.
// ============================================================

const { db } = require('../config/db');

// ── Niche definitions ──────────────────────────────────────
const NICHE_DEFINITIONS = {
  tech: {
    name: 'Technology',
    topics: ['programming', 'ai', 'machine learning', 'software', 'coding', 'tech', 'startup', 'developer', 'data science', 'cloud', 'security', 'devops', 'blockchain'],
    contentTypes: ['article', 'tutorial', 'documentation'],
    creatorKeywords: ['engineer', 'developer', 'programmer', 'cto', 'tech lead'],
    weight: 1.0
  },
  gaming: {
    name: 'Gaming',
    topics: ['gaming', 'esports', 'streaming', 'console', 'pc gaming', 'mobile gaming', 'mmorpg', 'fps', 'battle royale', 'game dev'],
    contentTypes: ['stream', 'clip', 'review', 'gameplay'],
    creatorKeywords: ['streamer', 'gamer', 'esports', 'content creator'],
    weight: 1.0
  },
  lifestyle: {
    name: 'Lifestyle',
    topics: ['lifestyle', 'wellness', 'fitness', 'health', 'mindfulness', 'self care', 'productivity', 'minimalism', 'personal growth'],
    contentTypes: ['blog', 'vlog', 'tutorial', 'inspirational'],
    creatorKeywords: ['influencer', 'life coach', 'wellness expert'],
    weight: 1.0
  },
  fashion: {
    name: 'Fashion & Beauty',
    topics: ['fashion', 'beauty', 'style', 'makeup', 'skincare', 'hair', 'outfits', 'streetwear', 'luxury', 'accessories'],
    contentTypes: ['lookbook', 'tutorial', 'review', 'haul'],
    creatorKeywords: ['fashionista', 'stylist', 'makeup artist', 'model'],
    weight: 1.0
  },
  food: {
    name: 'Food & Cooking',
    topics: ['food', 'cooking', 'recipes', 'baking', 'restaurant', 'chef', 'cuisine', 'gourmet', 'street food', 'food science'],
    contentTypes: ['recipe', 'review', 'tutorial', 'food blog'],
    creatorKeywords: ['chef', 'foodie', 'cook', 'restaurateur'],
    weight: 1.0
  },
  travel: {
    name: 'Travel',
    topics: ['travel', 'adventure', 'exploration', 'backpacking', 'luxury travel', 'digital nomad', 'wanderlust', 'culture'],
    contentTypes: ['travel blog', 'vlog', 'guide', 'review'],
    creatorKeywords: ['travel blogger', 'explorer', 'nomad', 'tour guide'],
    weight: 1.0
  },
  education: {
    name: 'Education & Learning',
    topics: ['education', 'learning', 'skills', 'knowledge', 'tutoring', 'online learning', 'courses', 'studying'],
    contentTypes: ['tutorial', 'lesson', 'course', 'educational'],
    creatorKeywords: ['educator', 'teacher', 'professor', 'trainer'],
    weight: 1.0
  },
  business: {
    name: 'Business & Finance',
    topics: ['business', 'finance', 'entrepreneurship', 'investing', 'trading', 'startup', 'marketing', 'sales', 'management'],
    contentTypes: ['business blog', 'analysis', 'case study', 'financial report'],
    creatorKeywords: ['entrepreneur', 'ceo', 'founder', 'investor', 'analyst'],
    weight: 1.0
  },
  art: {
    name: 'Art & Design',
    topics: ['art', 'design', 'graphic design', 'illustration', 'photography', 'painting', 'digital art', 'creative'],
    contentTypes: ['gallery', 'tutorial', 'process', 'inspiration'],
    creatorKeywords: ['artist', 'designer', 'illustrator', 'photographer'],
    weight: 1.0
  },
  music: {
    name: 'Music',
    topics: ['music', 'production', 'guitar', 'piano', 'electronic', 'hip hop', 'classical', 'jazz', 'songwriting'],
    contentTypes: ['performance', 'tutorial', 'production', 'review'],
    creatorKeywords: ['musician', 'producer', 'singer', 'dj', 'composer'],
    weight: 1.0
  },
  fitness: {
    name: 'Fitness & Sports',
    topics: ['fitness', 'workout', 'gym', 'running', 'yoga', 'weightlifting', 'calisthenics', 'sports', 'nutrition'],
    contentTypes: ['workout', 'guide', 'tutorial', 'nutrition advice'],
    creatorKeywords: ['fitness trainer', 'coach', 'athlete', 'bodybuilder'],
    weight: 1.0
  },
  health: {
    name: 'Health & Wellness',
    topics: ['health', 'wellness', 'mental health', 'nutrition', 'self care', 'therapy', 'meditation', 'holistic'],
    contentTypes: ['wellness blog', 'guide', 'meditation', 'self care tips'],
    creatorKeywords: ['health coach', 'nutritionist', 'psychologist', 'wellness expert'],
    weight: 1.0
  }
};

// ── User niche detection ──────────────────────────────────

/**
 * Detect a user's primary niches based on their activity
 * 
 * @param {number} userId
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} User niches with scores
 */
async function detectUserNiches(userId, options = {}) {
  if (!userId) return { niches: [], nicheMap: {} };

  const {
    minScore = 0.1,
    maxNiches = 5,
    includeAll = false,
    recencyWeight = 0.7,
    engagementWeight = 0.3
  } = options;

  // ── Fetch user activity data ─────────────────────────────
  const [
    topicsEngaged,
    followedCreators,
    groupMemberships,
    contentPreferences,
    recentLikes,
    recentComments,
    recentReposts
  ] = await Promise.all([
    getTopicsEngaged(userId),
    getFollowedCreatorsNiches(userId),
    getGroupNiches(userId),
    getContentTypePreferences(userId),
    getRecentLikes(userId, 50),
    getRecentComments(userId, 30),
    getRecentReposts(userId, 20)
  ]);

  // ── Calculate niche scores ──────────────────────────────
  const nicheScores = {};

  for (const [nicheKey, nicheDef] of Object.entries(NICHE_DEFINITIONS)) {
    let score = 0;
    let signals = [];

    // 1. Topic engagement
    const topicScore = calculateTopicScore(nicheDef.topics, topicsEngaged);
    if (topicScore > 0) {
      score += topicScore * 0.35;
      signals.push({ type: 'topics', score: topicScore });
    }

    // 2. Creator following
    const creatorScore = calculateCreatorScore(nicheDef.creatorKeywords, followedCreators);
    if (creatorScore > 0) {
      score += creatorScore * 0.25;
      signals.push({ type: 'creators', score: creatorScore });
    }

    // 3. Group membership
    const groupScore = calculateGroupScore(nicheDef.topics, groupMemberships);
    if (groupScore > 0) {
      score += groupScore * 0.10;
      signals.push({ type: 'groups', score: groupScore });
    }

    // 4. Content type preference
    const contentTypeScore = calculateContentTypeScore(nicheDef.contentTypes, contentPreferences);
    if (contentTypeScore > 0) {
      score += contentTypeScore * 0.15;
      signals.push({ type: 'content_type', score: contentTypeScore });
    }

    // 5. Recent engagement (weighted higher)
    const recentEngagementScore = calculateRecentEngagementScore(
      nicheDef.topics,
      nicheDef.creatorKeywords,
      { recentLikes, recentComments, recentReposts }
    );
    if (recentEngagementScore > 0) {
      score += recentEngagementScore * 0.15 * recencyWeight;
      signals.push({ type: 'recent_engagement', score: recentEngagementScore });
    }

    // Store if score is significant
    if (score > minScore) {
      nicheScores[nicheKey] = {
        key: nicheKey,
        name: nicheDef.name,
        score: Math.min(score * 100, 100),
        signals: signals.sort((a, b) => b.score - a.score),
        topTopics: getTopTopics(nicheDef.topics, topicsEngaged, 3)
      };
    }
  }

  // ── Sort and select top niches ──────────────────────────
  const sortedNiches = Object.values(nicheScores)
    .sort((a, b) => b.score - a.score);

  const selectedNiches = includeAll 
    ? sortedNiches 
    : sortedNiches.slice(0, maxNiches);

  const nicheMap = {};
  selectedNiches.forEach(niche => {
    nicheMap[niche.key] = niche.score;
  });

  // ── Add secondary niches if primary score is high ──────
  const primaryNiche = selectedNiches[0];
  if (primaryNiche && primaryNiche.score > 70) {
    const related = getRelatedNiches(primaryNiche.key);
    for (const relatedKey of related) {
      if (!nicheMap[relatedKey] && NICHE_DEFINITIONS[relatedKey]) {
        nicheMap[relatedKey] = 30;
      }
    }
  }

  return {
    niches: selectedNiches,
    nicheMap: nicheMap,
    primaryNiche: selectedNiches[0] || null,
    allScores: nicheScores,
    timestamp: new Date()
  };
}

// ── Helper functions ──────────────────────────────────────

async function getTopicsEngaged(userId) {
  const [rows] = await db.query(
    `SELECT 
       pt.topic,
       COUNT(CASE WHEN l.user_id IS NOT NULL THEN 1 END) AS likes,
       COUNT(CASE WHEN c.user_id IS NOT NULL THEN 1 END) AS comments,
       COUNT(CASE WHEN r.user_id IS NOT NULL THEN 1 END) AS reposts
     FROM post_topics pt
     LEFT JOIN likes l ON l.post_id = pt.post_id AND l.user_id = ?
     LEFT JOIN comments c ON c.post_id = pt.post_id AND c.user_id = ?
     LEFT JOIN reposts r ON r.repost_post_id = pt.post_id AND r.user_id = ?
     WHERE pt.post_id IN (
       SELECT post_id FROM likes WHERE user_id = ?
       UNION
       SELECT post_id FROM comments WHERE user_id = ?
       UNION
       SELECT repost_post_id FROM reposts WHERE user_id = ?
     )
     GROUP BY pt.topic
     ORDER BY (likes * 2 + comments * 4 + reposts * 3) DESC
     LIMIT 30`,
    [userId, userId, userId, userId, userId, userId]
  );

  const result = {};
  rows.forEach(row => {
    result[row.topic] = {
      likes: row.likes || 0,
      comments: row.comments || 0,
      reposts: row.reposts || 0,
      totalEngagement: (row.likes || 0) * 2 + (row.comments || 0) * 4 + (row.reposts || 0) * 3
    };
  });
  return result;
}

async function getFollowedCreatorsNiches(userId) {
  const [rows] = await db.query(
    `SELECT u.bio, u.occupation, u.name 
     FROM follows f
     JOIN users u ON u.id = f.following_id
     WHERE f.follower_id = ?
     LIMIT 50`,
    [userId]
  );
  return rows;
}

async function getGroupNiches(userId) {
  const [rows] = await db.query(
    `SELECT g.topic, g.description 
     FROM group_members gm
     JOIN \`groups\` g ON g.id = gm.group_id
     WHERE gm.user_id = ?
     LIMIT 30`,
    [userId]
  );
  return rows;
}

async function getContentTypePreferences(userId) {
  const [rows] = await db.query(
    `SELECT content_type, impressions, engagements 
     FROM user_content_type_preferences 
     WHERE user_id = ?`,
    [userId]
  );

  const result = {};
  rows.forEach(row => {
    // Calculate engagement rate as score
    const total = (row.impressions || 0) + (row.engagements || 0);
    result[row.content_type] = total > 0 ? (row.engagements || 0) / total * 100 : 0;
  });
  return result;
}

async function getRecentLikes(userId, limit = 50) {
  const [rows] = await db.query(
    `SELECT p.id, p.text, p.image, p.video, p.created_at, 
            pt.topic
     FROM likes l
     JOIN posts p ON p.id = l.post_id
     LEFT JOIN post_topics pt ON pt.post_id = p.id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function getRecentComments(userId, limit = 30) {
  // FIXED: Changed c.comment_text to c.text (actual column name)
  const [rows] = await db.query(
    `SELECT p.id, p.text, c.text AS comment_text, p.created_at,
            pt.topic
     FROM comments c
     JOIN posts p ON p.id = c.post_id
     LEFT JOIN post_topics pt ON pt.post_id = p.id
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

async function getRecentReposts(userId, limit = 20) {
  const [rows] = await db.query(
    `SELECT p.id, p.text, p.created_at,
            pt.topic
     FROM reposts r
     JOIN posts p ON p.id = r.repost_post_id
     LEFT JOIN post_topics pt ON pt.post_id = p.id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

function calculateTopicScore(nicheTopics, topicsEngaged) {
  let score = 0;
  let matches = 0;

  for (const topic of nicheTopics) {
    if (topicsEngaged[topic]) {
      const engagement = topicsEngaged[topic];
      const topicScore = Math.min(
        (engagement.likes * 1 + engagement.comments * 2 + engagement.reposts * 1.5) / 10,
        5
      );
      score += topicScore;
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.min(score / matches, 5);
}

function calculateCreatorScore(nicheKeywords, followedCreators) {
  let score = 0;
  let matches = 0;

  for (const creator of followedCreators) {
    const bio = (creator.bio || '').toLowerCase();
    const occupation = (creator.occupation || '').toLowerCase();
    const name = (creator.name || '').toLowerCase();

    for (const keyword of nicheKeywords) {
      if (bio.includes(keyword) || occupation.includes(keyword) || name.includes(keyword)) {
        score += 1;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;
  return Math.min(score / Math.min(followedCreators.length, 10), 5);
}

function calculateGroupScore(nicheTopics, groupMemberships) {
  let score = 0;
  let matches = 0;

  for (const group of groupMemberships) {
    const topic = (group.topic || '').toLowerCase();
    const description = (group.description || '').toLowerCase();

    for (const nicheTopic of nicheTopics) {
      if (topic.includes(nicheTopic) || description.includes(nicheTopic)) {
        score += 1;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;
  return Math.min(score / Math.min(groupMemberships.length, 5), 5);
}

function calculateContentTypeScore(nicheContentTypes, contentPreferences) {
  let score = 0;
  let matches = 0;

  for (const contentType of nicheContentTypes) {
    if (contentPreferences[contentType] !== undefined) {
      score += contentPreferences[contentType] / 20;
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.min(score / matches, 5);
}

function calculateRecentEngagementScore(nicheTopics, nicheKeywords, { recentLikes, recentComments, recentReposts }) {
  let score = 0;
  let matches = 0;

  const allRecent = [...recentLikes, ...recentComments, ...recentReposts];
  const recentMap = {};

  for (const item of allRecent) {
    if (item.topic) {
      recentMap[item.topic] = (recentMap[item.topic] || 0) + 1;
    }
  }

  for (const topic of nicheTopics) {
    if (recentMap[topic]) {
      score += Math.min(recentMap[topic] * 0.5, 3);
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.min(score / matches, 5);
}

function getTopTopics(nicheTopics, topicsEngaged, limit = 3) {
  const sorted = nicheTopics
    .map(topic => ({
      topic,
      score: topicsEngaged[topic]?.totalEngagement || 0
    }))
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return sorted.map(t => t.topic);
}

function getRelatedNiches(nicheKey) {
  const relatedMap = {
    tech: ['business', 'education'],
    gaming: ['tech', 'music', 'art'],
    lifestyle: ['fitness', 'health', 'food'],
    fashion: ['art', 'lifestyle'],
    food: ['lifestyle', 'travel'],
    travel: ['lifestyle', 'food', 'art'],
    education: ['tech', 'business', 'art'],
    business: ['tech', 'education'],
    art: ['design', 'fashion', 'music'],
    music: ['art', 'entertainment'],
    fitness: ['lifestyle', 'health'],
    health: ['lifestyle', 'fitness']
  };
  return relatedMap[nicheKey] || [];
}

// ── Cache niche scores ────────────────────────────────────
const nicheCache = new Map();
const CACHE_TTL = 3600000;

async function getCachedUserNiches(userId, options = {}) {
  const cacheKey = `${userId}`;
  const cached = nicheCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const data = await detectUserNiches(userId, options);
  nicheCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

function clearNicheCache(userId = null) {
  if (userId) {
    nicheCache.delete(`${userId}`);
  } else {
    nicheCache.clear();
  }
}

async function updateUserNiches(userId, postId, engagementType) {
  clearNicheCache(userId);
  
  await db.query(
    `INSERT INTO user_niches (user_id, niche_key, score, updated_at)
     VALUES (?, ?, 1, NOW())
     ON DUPLICATE KEY UPDATE 
       score = score * 0.7 + 1 * 0.3,
       updated_at = NOW()`,
    [userId, engagementType]
  );
}

module.exports = {
  NICHE_DEFINITIONS,
  detectUserNiches,
  getCachedUserNiches,
  clearNicheCache,
  updateUserNiches
};