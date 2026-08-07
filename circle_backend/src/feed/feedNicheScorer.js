// ============================================================
//  feed/feedNicheScorer.js
//
//  Computes niche affinity scores for posts based on user niches.
//  This module works alongside feedScorer.js to add niche-based
//  ranking signals.
// ============================================================

const C = require('../config/constants');
const { NICHE_DEFINITIONS } = require('./nicheModel');

/**
 * Compute niche score for a post given user niches
 * 
 * @param {Object} post - The post to score
 * @param {Object} userNiches - User's niche data
 * @param {number} viewerUserId - User ID
 * @returns {number} Niche score between 0 and 1
 */
function computeNicheScore(post, userNiches, viewerUserId) {
  if (!viewerUserId || !userNiches || !userNiches.nicheMap || !post._topics) {
    return 0;
  }

  const postTopics = post._topics || [];
  const nicheMap = userNiches.nicheMap || {};
  let totalScore = 0;
  let matches = 0;

  // Check each niche that the user is interested in
  for (const [nicheKey, nicheScore] of Object.entries(nicheMap)) {
    const nicheDef = NICHE_DEFINITIONS[nicheKey];
    if (!nicheDef) continue;

    // 1. Topic overlap
    const topicOverlap = postTopics.filter(t => nicheDef.topics.includes(t));
    if (topicOverlap.length > 0) {
      const overlapScore = topicOverlap.length / Math.min(postTopics.length, 3);
      totalScore += (nicheScore / 100) * overlapScore * 0.6; // 60% weight to topics
      matches++;
    }

    // 2. Creator alignment (check author bio/occupation)
    if (nicheDef.creatorKeywords && nicheDef.creatorKeywords.length) {
      const authorBio = (post.author || '').toLowerCase();
      const authorOccupation = (post.authorOccupation || '').toLowerCase();
      
      const creatorMatch = nicheDef.creatorKeywords.some(kw => 
        authorBio.includes(kw) || authorOccupation.includes(kw)
      );
      
      if (creatorMatch) {
        totalScore += (nicheScore / 100) * 0.3; // 30% weight to creator
        matches++;
      }
    }

    // 3. Content type match
    if (nicheDef.contentTypes && nicheDef.contentTypes.length) {
      let postType = 'text';
      if (post.video) postType = 'video';
      else if (post.image) postType = 'image';
      else if (post.text && post.text.length > 500) postType = 'article';
      
      // Map content types to niche content types
      const typeMap = {
        'video': ['stream', 'vlog', 'tutorial', 'performance', 'gameplay', 'clip'],
        'image': ['gallery', 'lookbook', 'infographic'],
        'article': ['blog', 'article', 'tutorial', 'guide', 'analysis'],
        'text': ['blog', 'post', 'update']
      };
      
      const typeMatches = typeMap[postType] || [];
      const contentTypeMatch = typeMatches.some(t => nicheDef.contentTypes.includes(t));
      
      if (contentTypeMatch) {
        totalScore += (nicheScore / 100) * 0.1; // 10% weight to content type
        matches++;
      }
    }
  }

  // Average and cap at 1.0
  const avgScore = matches > 0 ? totalScore / matches : 0;
  return Math.min(avgScore, 1.0);
}

/**
 * Generate niche-based reason for a post
 * 
 * @param {Object} post - The post
 * @param {Object} userNiches - User's niche data
 * @returns {string|null} Reason string or null
 */
function generateNicheReason(post, userNiches) {
  if (!userNiches || !userNiches.nicheMap || !post._nicheScore || post._nicheScore < 0.3) {
    return null;
  }

  const nicheMap = userNiches.nicheMap || {};
  const postTopics = post._topics || [];
  
  // Find the highest matching niche
  let bestNiche = null;
  let bestScore = 0;

  for (const [nicheKey, nicheScore] of Object.entries(nicheMap)) {
    const nicheDef = NICHE_DEFINITIONS[nicheKey];
    if (!nicheDef) continue;

    const topicOverlap = postTopics.filter(t => nicheDef.topics.includes(t));
    if (topicOverlap.length > 0) {
      const overlapScore = (nicheScore / 100) * (topicOverlap.length / Math.min(postTopics.length, 3));
      if (overlapScore > bestScore) {
        bestScore = overlapScore;
        bestNiche = nicheDef.name;
      }
    }
  }

  if (bestNiche) {
    return `Recommended based on your interest in ${bestNiche}`;
  }

  return null;
}

module.exports = {
  computeNicheScore,
  generateNicheReason
};