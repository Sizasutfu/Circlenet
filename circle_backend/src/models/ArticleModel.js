// ============================================================
//  models/ArticleModel.js
//  All database queries for articles, comments, likes, echoes.
//
//  Mirrors PostModel.js patterns:
//    • raw MySQL2 via db.query()
//    • camelCase aliasing in SELECT
//    • nestComments() for threaded replies
//    • hydration separated from raw fetch
// ============================================================

const { db } = require('../config/db');

// ── Helpers ───────────────────────────────────────────────────

function toRelativePath(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/uploads/')) return u.pathname;
  } catch {}
  return url;
}

function nestComments(flatComments) {
  const byId  = {};
  const roots = [];
  flatComments.forEach(c => { byId[c.id] = { ...c, replies: [] }; });
  flatComments.forEach(c => {
    if (c.parentId && byId[c.parentId]) {
      byId[c.parentId].replies.push(byId[c.id]);
    } else {
      roots.push(byId[c.id]);
    }
  });
  return roots;
}

// ── Hydrate raw article rows with engagement counts ───────────
async function hydrateArticles(articles) {
  if (!articles.length) return articles;

  const ids = articles.map(a => a.id);
  const ph  = ids.map(() => '?').join(',');

  const [[allLikes], [allEchoes], [allComments]] = await Promise.all([
    db.query(
      `SELECT user_id, article_id FROM article_likes WHERE article_id IN (${ph})`,
      ids
    ),
    db.query(
      `SELECT user_id, article_id FROM article_echoes WHERE article_id IN (${ph})`,
      ids
    ),
    db.query(
      `SELECT c.id, c.article_id, c.user_id AS userId,
              c.parent_id AS parentId,
              u.name AS author, u.picture AS authorPicture,
              c.text, c.created_at AS createdAt
       FROM article_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.article_id IN (${ph})
       ORDER BY c.created_at ASC`,
      ids
    ),
  ]);

  const lMap = {}, eMap = {}, cMap = {};
  ids.forEach(id => { lMap[id] = []; eMap[id] = []; cMap[id] = []; });
  allLikes.forEach(l    => lMap[l.article_id]?.push(l.user_id));
  allEchoes.forEach(e   => eMap[e.article_id]?.push(e.user_id));
  allComments.forEach(c => cMap[c.article_id]?.push(c));

  articles.forEach(a => {
    a.likes    = lMap[a.id] || [];
    a.echoes   = eMap[a.id] || [];
    a.comments = nestComments(cMap[a.id] || []);
    a.coverImage = toRelativePath(a.coverImage);
    a.authorPicture = toRelativePath(a.authorPicture);
  });

  return articles;
}

// ── CRUD ──────────────────────────────────────────────────────

// GET /api/articles  — paginated, with optional tag + search filters
async function getArticles({ page = 1, limit = 6, tag = null, q = null } = {}) {
  const LIMIT  = Math.min(50, Math.max(1, limit));
  const OFFSET = (page - 1) * LIMIT;

  let where  = 'WHERE a.published = 1';
  const params = [];

  if (tag) {
    // article_tags is a JOIN table: (article_id, tag)
    where += ' AND EXISTS (SELECT 1 FROM article_tags t WHERE t.article_id = a.id AND t.tag = ?)';
    params.push(tag);
  }
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    where += ' AND (a.title LIKE ? OR a.excerpt LIKE ?)';
    params.push(like, like);
  }

  const [rawArticles] = await db.query(
    `SELECT
       a.id,
       a.user_id         AS userId,
       u.name            AS author,
       u.picture         AS authorPicture,
       a.title,
       a.excerpt,
       a.content,
       a.cover_image     AS coverImage,
       a.published,
       a.created_at      AS createdAt
     FROM articles a
     JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, LIMIT + 1, OFFSET]
  );

  const hasMore   = rawArticles.length > LIMIT;
  const pageRows  = rawArticles.slice(0, LIMIT);

  // Fetch tags for returned articles
  if (pageRows.length) {
    const ids = pageRows.map(a => a.id);
    const ph  = ids.map(() => '?').join(',');
    const [tagRows] = await db.query(
      `SELECT article_id, tag FROM article_tags WHERE article_id IN (${ph})`,
      ids
    );
    const tagMap = {};
    ids.forEach(id => { tagMap[id] = []; });
    tagRows.forEach(t => tagMap[t.article_id]?.push(t.tag));
    pageRows.forEach(a => { a.tags = tagMap[a.id] || []; });
  }

  const articles = await hydrateArticles(pageRows);
  return { articles, hasMore, page, limit: LIMIT };
}

// GET /api/articles/:id
async function findById(id) {
  const [rows] = await db.query(
    `SELECT
       a.id,
       a.user_id         AS userId,
       u.name            AS author,
       u.picture         AS authorPicture,
       a.title,
       a.excerpt,
       a.content,
       a.cover_image     AS coverImage,
       a.published,
       a.created_at      AS createdAt
     FROM articles a
     JOIN users u ON u.id = a.user_id
     WHERE a.id = ?`,
    [id]
  );
  if (!rows.length) return null;

  // Attach tags
  const [tagRows] = await db.query(
    'SELECT tag FROM article_tags WHERE article_id = ?',
    [id]
  );
  rows[0].tags = tagRows.map(t => t.tag);

  const [hydrated] = await hydrateArticles(rows);
  return hydrated;
}

// POST /api/articles  — create article + tags
async function createArticle(userId, { title, excerpt, content, coverImage, tags = [], published = false }) {
  const [result] = await db.query(
    `INSERT INTO articles (user_id, title, excerpt, content, cover_image, published)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, title, excerpt || null, content, coverImage || null, published ? 1 : 0]
  );
  const articleId = result.insertId;
  await _saveTags(articleId, tags);
  return articleId;
}

// PUT /api/articles/:id
async function updateArticle(id, { title, excerpt, content, coverImage, tags, published }) {
  const fields  = [];
  const params  = [];

  if (title      !== undefined) { fields.push('title = ?');       params.push(title); }
  if (excerpt    !== undefined) { fields.push('excerpt = ?');     params.push(excerpt); }
  if (content    !== undefined) { fields.push('content = ?');     params.push(content); }
  if (coverImage !== undefined) { fields.push('cover_image = ?'); params.push(coverImage); }
  if (published  !== undefined) { fields.push('published = ?');   params.push(published ? 1 : 0); }

  if (fields.length) {
    params.push(id);
    await db.query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  if (Array.isArray(tags)) {
    await db.query('DELETE FROM article_tags WHERE article_id = ?', [id]);
    await _saveTags(id, tags);
  }
}

// DELETE /api/articles/:id
async function deleteArticle(id) {
  await db.query('DELETE FROM articles WHERE id = ?', [id]);
  // article_tags, article_likes, article_echoes, article_comments
  // cascade via FK — or delete manually if FKs not set:
  await db.query('DELETE FROM article_tags     WHERE article_id = ?', [id]);
  await db.query('DELETE FROM article_likes    WHERE article_id = ?', [id]);
  await db.query('DELETE FROM article_echoes   WHERE article_id = ?', [id]);
  await db.query('DELETE FROM article_comments WHERE article_id = ?', [id]);
}

// ── Likes ────────────────────────────────────────────────────

async function getLike(userId, articleId) {
  const [[row]] = await db.query(
    'SELECT id FROM article_likes WHERE user_id = ? AND article_id = ?',
    [userId, articleId]
  );
  return row || null;
}

async function addLike(userId, articleId) {
  await db.query(
    'INSERT IGNORE INTO article_likes (user_id, article_id) VALUES (?, ?)',
    [userId, articleId]
  );
}

async function removeLike(userId, articleId) {
  await db.query(
    'DELETE FROM article_likes WHERE user_id = ? AND article_id = ?',
    [userId, articleId]
  );
}

async function getLikeCount(articleId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM article_likes WHERE article_id = ?',
    [articleId]
  );
  return Number(total);
}

// ── Echoes ───────────────────────────────────────────────────

async function getEcho(userId, articleId) {
  const [[row]] = await db.query(
    'SELECT id FROM article_echoes WHERE user_id = ? AND article_id = ?',
    [userId, articleId]
  );
  return row || null;
}

async function addEcho(userId, articleId) {
  await db.query(
    'INSERT IGNORE INTO article_echoes (user_id, article_id) VALUES (?, ?)',
    [userId, articleId]
  );
}

async function removeEcho(userId, articleId) {
  await db.query(
    'DELETE FROM article_echoes WHERE user_id = ? AND article_id = ?',
    [userId, articleId]
  );
}

async function getEchoCount(articleId) {
  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM article_echoes WHERE article_id = ?',
    [articleId]
  );
  return Number(total);
}

// ── Comments ─────────────────────────────────────────────────

async function addComment(articleId, userId, text, parentId = null) {
  const [result] = await db.query(
    `INSERT INTO article_comments (article_id, user_id, text, parent_id)
     VALUES (?, ?, ?, ?)`,
    [articleId, userId, text, parentId || null]
  );
  return result.insertId;
}

// ── Internal helpers ─────────────────────────────────────────

async function _saveTags(articleId, tags) {
  if (!tags.length) return;
  const values = tags.map(t => [articleId, t.toLowerCase().trim()]);
  await db.query(
    'INSERT IGNORE INTO article_tags (article_id, tag) VALUES ?',
    [values]
  );
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  getArticles,
  findById,
  createArticle,
  updateArticle,
  deleteArticle,
  hydrateArticles,
  nestComments,
  getLike,
  addLike,
  removeLike,
  getLikeCount,
  getEcho,
  addEcho,
  removeEcho,
  getEchoCount,
  addComment,
};
