// middleware/seo.js
// Server-side rendering for search engine / social media crawlers.
//
// How it works:
//   1. Registers /robots.txt, /sitemap.xml, /post/:id, /profile/:userId
//   2. For /post and /profile: checks if requester is a known bot
//   3. Bots → pre-filled HTML with real content baked in (great for Google/social previews)
//   4. Real users → next() so the SPA index.html loads normally
//
// Usage in app.js (AFTER API routes, BEFORE SPA fallback):
//   const { seoMiddleware } = require('./middleware/seo');
//   seoMiddleware(app);

const { db } = require('../config/db');

// ── Bot detection ─────────────────────────────────────────────────────────────
const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|embedly|ia_archiver|pinterestbot|slackbot-linkexpanding/i;

function isBot(req) {
  return BOT_UA.test(req.headers['user-agent'] || '');
}

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_URL     = 'https://www.circlenet.social';
const DEFAULT_IMG  = `${BASE_URL}/og-image.png`;
const TWITTER_SITE = '@circlenet'; // update if your handle differs

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

function truncate(str = '', len = 155) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

// Resolve relative /uploads/... paths to absolute URLs for og:image.
// Rejects non-http(s) schemes (e.g. javascript:, data:) to prevent injection.
function toAbsUrl(path) {
  if (!path) return DEFAULT_IMG;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${BASE_URL}${path}`;
  return DEFAULT_IMG; // reject anything else (data:, javascript:, etc.)
}

function buildHtml({ title, description, image, url, bodyText }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(url)}" />

  <meta property="og:type"         content="website" />
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

// ── DB queries (mysql2 style — same pattern as PostModel.js) ─────────────────
async function fetchPost(id) {
  const [rows] = await db.query(
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
  return rows[0] || null;
}

async function fetchUser(userId) {
  const [rows] = await db.query(
    `SELECT id, name, bio, picture
     FROM   users
     WHERE  id = ?
     LIMIT  1`,
    [userId]
  );
  return rows[0] || null;
}

// ── Route: /post/:id ──────────────────────────────────────────────────────────
async function handlePost(req, res, next) {
  if (!isBot(req)) return next();

  let post;
  try {
    post = await fetchPost(req.params.id);
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

  let user;
  try {
    user = await fetchUser(req.params.userId);
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
  res.send(buildHtml({
    title: `${name} on Circle`,
    description,
    image,
    url,
    bodyText: user.bio || '',
  }));
}

// ── Route: /sitemap.xml ───────────────────────────────────────────────────────
async function handleSitemap(req, res) {
  // Serve from cache if fresh
  if (sitemapCache.xml && Date.now() - sitemapCache.ts < SITEMAP_TTL) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(sitemapCache.xml);
  }

  try {
    // db.query returns [rows, fields] — destructure correctly
    const [[posts], [users]] = await Promise.all([
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
    ]);

    // Note: the destructuring above assigns `posts = rows` and `users = rows`
    // because db.query resolves to [rows, fields]. Verify this matches your
    // mysql2 promise wrapper — if it returns rows directly (not [rows, fields]),
    // change to: const [posts, users] = await Promise.all([...])

    const toDate = d => (d ? new Date(d).toISOString().split('T')[0] : null);

    const urlTags = (items, pathPrefix, priority) =>
      items.map(row => {
        const lastmod = toDate(row.updatedAt);
        return `
  <url>
    <loc>${BASE_URL}/${pathPrefix}/${row.id}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
      }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>${urlTags(posts, 'post', '0.6')}${urlTags(users, 'profile', '0.7')}
</urlset>`;

    // Store in cache
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

// ── Mount all SEO routes ──────────────────────────────────────────────────────
function seoMiddleware(app) {
  app.get('/robots.txt',      handleRobots);
  app.get('/sitemap.xml',     handleSitemap);
  app.get('/post/:id',        handlePost);
  app.get('/profile/:userId', handleProfile);
}

module.exports = { seoMiddleware };