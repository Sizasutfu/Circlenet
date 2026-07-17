// scripts/computePostSimilarities.js
const { db } = require('../config/db');

// For each post, find up to 20 most similar posts based on Jaccard of user engagement.
// We consider "engagement" = likes, comments, reposts (unified as interactions).
async function computeSimilarities() {
  // Get all post engagement sets: post_id -> array of user_ids
  const [rows] = await db.query(`
    SELECT post_id, user_id FROM (
      SELECT post_id, user_id FROM likes
      UNION
      SELECT post_id, user_id FROM comments
      UNION
      SELECT original_post_id AS post_id, user_id FROM reposts
    ) AS interactions
  `);

  // Build map: post_id -> Set of user_ids
  const postUsers = {};
  rows.forEach(({ post_id, user_id }) => {
    if (!postUsers[post_id]) postUsers[post_id] = new Set();
    postUsers[post_id].add(user_id);
  });

  const postIds = Object.keys(postUsers);
  const similarityThreshold = 0.05; // only store scores above this

  // For each post, compute Jaccard with every other post (naive O(n²) – optimize if needed)
  const similarities = [];
  for (let i = 0; i < postIds.length; i++) {
    const pid1 = postIds[i];
    const set1 = postUsers[pid1];
    if (set1.size < 2) continue; // skip posts with too few engagements

    for (let j = i + 1; j < postIds.length; j++) {
      const pid2 = postIds[j];
      const set2 = postUsers[pid2];
      if (set2.size < 2) continue;

      const intersection = new Set([...set1].filter(x => set2.has(x)));
      if (intersection.size === 0) continue;

      const unionSize = set1.size + set2.size - intersection.size;
      const jaccard = intersection.size / unionSize;
      if (jaccard > similarityThreshold) {
        similarities.push([pid1, pid2, jaccard]);
        similarities.push([pid2, pid1, jaccard]); // store both directions
      }
    }
  }

  // Insert into post_similarities (clear first)
  await db.query('TRUNCATE post_similarities');
  if (similarities.length) {
    await db.query(
      'INSERT INTO post_similarities (post_id, similar_post_id, score) VALUES ?',
      [similarities.map(([p1, p2, s]) => [p1, p2, s])]
    );
  }

  console.log(`Stored ${similarities.length} similarities.`);
}

computeSimilarities().catch(console.error);