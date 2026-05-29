// middleware/seo.js
// Server-side rendering for search engine / social media crawlers.
//
// How it works:
//   1. Registers /robots.txt, /sitemap.xml, /post/:id, /profile/:userId, /articles/:slug
//   2. For dynamic routes: checks if requester is a known bot
//   3. Bots → pre-filled HTML with real content baked in
//   4. Real users → next() so the SPA index.html loads normally

const { db } = require('../config/db');
const ArticleModel = require('../models/ArticleModel');

// ── Bot detection ─────────────────────────────────────────────────────────────
const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|embedly|ia_archiver|pinterestbot|slackbot-linkexpanding/i;

function isBot(req) {
  return BOT_UA.test(req.headers['user-agent'] || '');
}

// ── Configuration (from environment) ──────────────────────────────────────────
const BASE_URL     = process.env.BASE_URL || 'https://www.circlenet.social';
const DEFAULT_IMG  = `${BASE_URL}/og-image.png`;
const TWITTER_SITE = process.env.TWITTER_SITE || '@circlenet';

// ── Sitemap in-memory cache ───────────────────────────────────────────────────
let sitemapCache = { xml: null, ts: 0 };
const SITEMAP_TTL = 3_600_000; // 1 hour in ms

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Safe truncation that respects multi-byte characters (emojis, etc.)
function truncate(str = '', len = 155) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  if (s.length <= len) return s;
  // Use Array.from to correctly handle Unicode code points
  const chars = Array.from(s);
  if (chars.length <= len) return s;
  return chars.slice(0, len - 1).join('') + '…';
}

/**
 * Convert image path to absolute URL for og:image.
 * - Absolute HTTP/HTTPS URLs are kept as-is (optionally restrict to own domain below).
 * - Relative paths are prefixed with BASE_URL.
 * - Invalid or missing paths return the default OG image.
 */
function toAbsUrl(path) {
  if (!path) return DEFAULT_IMG;

  // Already absolute – keep it (you may restrict to BASE_URL if needed)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Optional: block external domains to avoid mixed content / security issues
    // if (!path.startsWith(BASE_URL)) return DEFAULT_IMG;
    return path;
  }

  // Relative path: remove leading './' or '../' (simplified)
  let cleanPath = path.replace(/^(\.\.\/|\.\/)/, '');
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  return `${BASE_URL}${cleanPath}`;
}

async function fetchArticleBySlug(slug) {
  if (!slug) return null;
  return await ArticleModel.findBySlug(slug);
}

function buildHtml({ title, description, image, url, bodyText, type = 'website' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />

  <meta property="og:type"         content="${esc(type)}" />
  <meta property="og:site_name"    content="Circle" />
  <meta property="og:url"          content="${esc(url)}" />
  <meta property="og:title"        content="${esc(title)}" />
  <meta property="og:description"  content="${esc(description)}" />
  <meta property="og:image"        content="${esc(image)}" />
  <meta property="og:image:width"  content="1200" />
  <meta property="og:image:height" content="630" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:site"        content="${esc(TWITTER_SITE)}" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image"       content="${esc(image)}" />
</head>
<body>
  <h1>${esc(title)}</h1>
  <p>${esc(bodyText)}</p>
</body>
</html>`;
}

// Validate numeric ID (positive integer)
function isValidId(id) {
  const num = Number(id);
  return Number.isInteger(num) && num > 0;
}

// ── DB queries (handles both [rows, fields] and direct rows) ─────────────────
async function fetchPost(id) {
  const result = await db.query(
    `SELECT p.id,
            p.text,
            p.image,
            p.video,
            p.created_at    AS createdAt,
            u.name          AS author,
            u.picture       AS authorPicture
     FROM   posts p
     JOIN   users u ON u.id = p.user_id
     WHERE  p.id = ?
     LIMIT  1`,
    [id]
  );
  const rows = Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) ? result[0] : (Array.isArray(result) ? result : []);
  return rows[0] || null;
}

async function fetchUser(userId) {
  const result = await db.query(
    `SELECT id, name, bio, picture
     FROM   users
     WHERE  id = ?
     LIMIT  1`,
    [userId]
  );
  const rows = Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) ? result[0] : (Array.isArray(result) ? result : []);
  return rows[0] || null;
}

// ── Route: /post/:id ──────────────────────────────────────────────────────────
async function handlePost(req, res, next) {
  if (!isBot(req)) return next();

  const postId = req.params.id;
  if (!isValidId(postId)) {
    res.status(400).send('Invalid post ID');
    return;
  }

  let post;
  try {
    post = await fetchPost(postId);
  } catch (err) {
    console.error('[seo] handlePost DB error:', err.message);
    return next();
  }

  if (!post) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('Post not found');
  }

  const url         = `${BASE_URL}/post/${post.id}`;
  const author      = post.author || 'Someone';
  const description = truncate(post.text || `${author} shared a post on Circle.`);
  const image       = toAbsUrl(post.image || post.authorPicture);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(buildHtml({
    title: `${author} on Circle`,
    description,
    image,
    url,
    bodyText: post.text || '',
  }));
}

// ── Route: /profile/:userId ───────────────────────────────────────────────────
async function handleProfile(req, res, next) {
  if (!isBot(req)) return next();

  const userId = req.params.userId;
  if (!isValidId(userId)) {
    res.status(400).send('Invalid user ID');
    return;
  }

  let user;
  try {
    user = await fetchUser(userId);
  } catch (err) {
    console.error('[seo] handleProfile DB error:', err.message);
    return next();
  }

  if (!user) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('Profile not found');
  }

  const url         = `${BASE_URL}/profile/${user.id}`;
  const name        = user.name || 'A Circle user';
  const description = truncate(user.bio || `Check out ${name}'s profile on Circle.`);
  const image       = toAbsUrl(user.picture);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(buildHtml({
    title: `${name} on Circle`,
    description,
    image,
    url,
    bodyText: user.bio || '',
  }));
}

// ── Route: /articles/:slug ────────────────────────────────────────────────────
async function handleArticle(req, res, next) {
  if (!isBot(req)) return next();

  const slug = req.params.slug;
  if (!slug) {
    res.status(400).send('Invalid article slug');
    return;
  }

  let article;
  try {
    article = await fetchArticleBySlug(slug);
  } catch (err) {
    console.error('[seo] handleArticle DB error:', err.message);
    return next();
  }

  if (!article) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('Article not found');
  }

  const url = `${BASE_URL}/articles/${encodeURIComponent(slug)}`;
  const title = article.title ? `${article.title} · Circle` : 'Circle article';
  const description = truncate(article.excerpt || article.content || `Read this article on Circle.`);
  
  // Prioritize article cover, fallback to author picture, then default
  const imageSource = article.coverImage || article.cover_image || article.authorPicture || article.author_picture;
  const image = toAbsUrl(imageSource);
  
  const bodyText = truncate(article.content || article.excerpt || '', 240);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.send(buildHtml({
    title,
    description,
    image,
    url,
    bodyText,
    type: 'article',
  }));
}

// ── Route: /sitemap.xml ───────────────────────────────────────────────────────
function formatDateForSitemap(d) {
  if (d == null || d === 0) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

async function handleSitemap(req, res) {
  // Serve from cache if fresh
  if (sitemapCache.xml && Date.now() - sitemapCache.ts < SITEMAP_TTL) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(sitemapCache.xml);
  }

  try {
    // Execute both queries
    const [postsResult, usersResult, articlesResult] = await Promise.all([
      db.query(
        `SELECT id, updated_at AS updatedAt
         FROM   posts
         ORDER  BY created_at DESC
         LIMIT  50000`
      ),
      db.query(
        `SELECT id, updated_at AS updatedAt
         FROM   users
         ORDER  BY created_at DESC
         LIMIT  50000`
      ),
      db.query(
        `SELECT slug, updated_at AS updatedAt
         FROM   articles
         WHERE  published = 1
         ORDER  BY updated_at DESC
         LIMIT  50000`
      ),
    ]);

    // Normalize results (handle both [rows, fields] and direct rows)
    const normalize = (result) => {
      if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
        return result[0];
      }
      return Array.isArray(result) ? result : [];
    };

    const posts = normalize(postsResult);
    const users = normalize(usersResult);
    const articles = normalize(articlesResult);

    const buildUrlTags = (items, pathPrefix, priority, keyField = 'id') => {
      return items.map(row => {
        const lastmod = formatDateForSitemap(row.updatedAt);
        const idOrSlug = row[keyField];
        return `
  <url>
    <loc>${BASE_URL}/${pathPrefix}/${esc(idOrSlug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
      }).join('');
    };

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${buildUrlTags(posts, 'post', '0.6')}${buildUrlTags(users, 'profile', '0.7')}${buildUrlTags(articles, 'articles', '0.6', 'slug')}
</urlset>`;

    sitemapCache = { xml, ts: Date.now() };

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('[seo] sitemap error:', err.message);
    res.status(500).send('Sitemap unavailable');
  }
}

// ── Route: /robots.txt ────────────────────────────────────────────────────────
function handleRobots(req, res) {
  res.setHeader('Content-Type', 'text/plain');
  res.send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /uploads/

Sitemap: ${BASE_URL}/sitemap.xml`
  );
}

// ── Optional: function to invalidate sitemap cache after content changes ──────
function invalidateSitemapCache() {
  sitemapCache = { xml: null, ts: 0 };
}

// ── Mount all SEO routes ──────────────────────────────────────────────────────
function seoMiddleware(app) {
  app.get('/robots.txt',      handleRobots);
  app.get('/sitemap.xml',     handleSitemap);
  app.get('/post/:id',        handlePost);
  app.get('/profile/:userId', handleProfile);
  app.get('/articles/:slug',  handleArticle);
}

module.exports = { seoMiddleware, invalidateSitemapCache };