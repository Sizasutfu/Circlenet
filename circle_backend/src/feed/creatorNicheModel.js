// ============================================================
//  feed/creatorNicheModel.js
//
//  Detects what niches users CREATE content about,
//  NOT what they consume.
//  
//  This enables "People Like You" recommendations:
//  - If you post about fitness, we show you other fitness creators
//  - If you post about gaming, we show you other gamers
// ============================================================

const { db } = require('../config/db');

// ── Niche definitions ──────────────────────────────────────
const NICHE_DEFINITIONS = {
  tech: {
    name: 'Technology',
    topics: ['programming', 'ai', 'machine learning', 'software', 'coding', 'tech', 'startup', 'developer', 'data science', 'cloud', 'security', 'devops', 'blockchain'],
    keywords: ['engineer', 'developer', 'programmer', 'cto', 'tech lead']
  },
  gaming: {
    name: 'Gaming',
    topics: ['gaming', 'esports', 'streaming', 'console', 'pc gaming', 'mobile gaming', 'mmorpg', 'fps', 'battle royale', 'game dev'],
    keywords: ['streamer', 'gamer', 'esports', 'content creator', 'twitch']
  },
  lifestyle: {
    name: 'Lifestyle',
    topics: ['lifestyle', 'wellness', 'fitness', 'health', 'mindfulness', 'self care', 'productivity', 'minimalism', 'personal growth'],
    keywords: ['influencer', 'life coach', 'wellness expert']
  },
  fashion: {
    name: 'Fashion & Beauty',
    topics: ['fashion', 'beauty', 'style', 'makeup', 'skincare', 'hair', 'outfits', 'streetwear', 'luxury', 'accessories'],
    keywords: ['fashionista', 'stylist', 'makeup artist', 'model', 'beauty blogger']
  },
  food: {
    name: 'Food & Cooking',
    topics: ['food', 'cooking', 'recipes', 'baking', 'restaurant', 'chef', 'cuisine', 'gourmet', 'street food', 'food science'],
    keywords: ['chef', 'foodie', 'cook', 'restaurateur', 'food blogger']
  },
  travel: {
    name: 'Travel',
    topics: ['travel', 'adventure', 'exploration', 'backpacking', 'luxury travel', 'digital nomad', 'wanderlust', 'culture'],
    keywords: ['travel blogger', 'explorer', 'nomad', 'tour guide']
  },
  education: {
    name: 'Education & Learning',
    topics: ['education', 'learning', 'skills', 'knowledge', 'tutoring', 'online learning', 'courses', 'studying'],
    keywords: ['educator', 'teacher', 'professor', 'trainer', 'tutor']
  },
  business: {
    name: 'Business & Finance',
    topics: ['business', 'finance', 'entrepreneurship', 'investing', 'trading', 'startup', 'marketing', 'sales', 'management'],
    keywords: ['entrepreneur', 'ceo', 'founder', 'investor', 'analyst']
  },
  art: {
    name: 'Art & Design',
    topics: ['art', 'design', 'graphic design', 'illustration', 'photography', 'painting', 'digital art', 'creative'],
    keywords: ['artist', 'designer', 'illustrator', 'photographer', 'creative director']
  },
  music: {
    name: 'Music',
    topics: ['music', 'production', 'guitar', 'piano', 'electronic', 'hip hop', 'classical', 'jazz', 'songwriting'],
    keywords: ['musician', 'producer', 'singer', 'dj', 'composer']
  },
  fitness: {
    name: 'Fitness & Sports',
    topics: ['fitness', 'workout', 'gym', 'running', 'yoga', 'weightlifting', 'calisthenics', 'sports', 'nutrition'],
    keywords: ['fitness trainer', 'coach', 'athlete', 'bodybuilder', 'personal trainer']
  },
  health: {
    name: 'Health & Wellness',
    topics: ['health', 'wellness', 'mental health', 'nutrition', 'self care', 'therapy', 'meditation', 'holistic'],
    keywords: ['health coach', 'nutritionist', 'psychologist', 'wellness expert', 'therapist']
  }
};

async function detectCreatorNiches(userId, options = {}) {
  if (!userId) return { niches: [], nicheMap: {} };

  const { minScore = 0.1, maxNiches = 5, postLimit = 100 } = options;

  const userPosts = await getUserPosts(userId, postLimit);
  if (!userPosts.length) {
    return { niches: [], nicheMap: {}, message: 'User has no posts yet' };
  }

  const nicheScores = {};

  for (const [nicheKey, nicheDef] of Object.entries(NICHE_DEFINITIONS)) {
    let score = 0;
    let matchCount = 0;

    for (const post of userPosts) {
      const postText = (post.text || '').toLowerCase();
      const postTopics = post.topics || [];
      
      const topicMatch = nicheDef.topics.some(t => 
        postTopics.some(pt => pt.toLowerCase().includes(t) || t.includes(pt.toLowerCase()))
      );
      
      const keywordMatch = nicheDef.keywords.some(kw => postText.includes(kw));
      const topicInText = nicheDef.topics.some(t => postText.includes(t));

      if (topicMatch || keywordMatch || topicInText) {
        matchCount++;
        const hoursAgo = (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000;
        const ageWeight = Math.max(0.3, Math.exp(-hoursAgo / 720));
        const engagementWeight = Math.min(1.0, ((post.likes || 0) * 1 + (post.comments || 0) * 2) / 10);
        score += ageWeight * 0.7 + engagementWeight * 0.3;
      }
    }

    if (matchCount > 0) {
      const normalizedScore = Math.min(score / Math.min(matchCount, 5), 5);
      nicheScores[nicheKey] = {
        key: nicheKey,
        name: nicheDef.name,
        score: Math.min(normalizedScore * 20, 100),
        matchCount,
        matchPercentage: (matchCount / userPosts.length) * 100
      };
    }
  }

  const sortedNiches = Object.values(nicheScores).sort((a, b) => b.score - a.score);
  const selectedNiches = sortedNiches.slice(0, maxNiches);
  const nicheMap = {};
  selectedNiches.forEach(niche => { nicheMap[niche.key] = niche.score; });

  return {
    niches: selectedNiches,
    nicheMap: nicheMap,
    primaryNiche: selectedNiches[0] || null,
    allScores: nicheScores,
    totalPostsAnalyzed: userPosts.length,
    timestamp: new Date()
  };
}

async function getUserPosts(userId, limit = 100) {
  const [rows] = await db.query(
    `SELECT 
       p.id, p.text, p.created_at,
       (SELECT GROUP_CONCAT(topic) FROM post_topics WHERE post_id = p.id) AS topics_csv,
       (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes,
       (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments
     FROM posts p
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [userId, limit]
  );

  return rows.map(row => ({
    id: row.id,
    text: row.text || '',
    createdAt: row.created_at,
    topics: row.topics_csv ? row.topics_csv.split(',') : [],
    likes: row.likes || 0,
    comments: row.comments || 0
  }));
}

async function getSimilarCreators(viewerUserId, userNiches, limit = 10) {
  if (!viewerUserId || !userNiches || !userNiches.niches.length) return [];

  const primaryNiche = userNiches.niches[0];
  if (!primaryNiche) return [];

  const nicheDef = NICHE_DEFINITIONS[primaryNiche.key];
  if (!nicheDef) return [];

  const topicConditions = nicheDef.topics.map(() => '?').join(',');
  
  const [rows] = await db.query(
    `SELECT DISTINCT 
       u.id, u.name, u.username, u.picture, u.verified,
       COUNT(DISTINCT p.id) AS post_count,
       (SELECT COUNT(*) FROM likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = u.id)) AS total_likes
     FROM users u
     JOIN posts p ON p.user_id = u.id
     JOIN post_topics pt ON pt.post_id = p.id
     WHERE u.id != ?
       AND pt.topic IN (${topicConditions})
       AND p.created_at >= NOW() - INTERVAL 30 DAY
     GROUP BY u.id
     HAVING post_count >= 1
     ORDER BY total_likes DESC, post_count DESC
     LIMIT ?`,
    [viewerUserId, ...nicheDef.topics, limit]
  );

  return rows;
}

const cache = new Map();
const CACHE_TTL = 3600000;

async function getCachedCreatorNiches(userId, options = {}) {
  const cacheKey = `${userId}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL && !options.forceRefresh) {
    return cached.data;
  }
  const data = await detectCreatorNiches(userId, options);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

module.exports = {
  NICHE_DEFINITIONS,
  detectCreatorNiches,
  getCachedCreatorNiches,
  getSimilarCreators
};