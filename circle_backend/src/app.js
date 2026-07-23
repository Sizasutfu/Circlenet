// app.js – Circle API application logic

const path               = require('path');
const express            = require('express');
const webpush            = require('web-push');
const { cors }           = require('./middleware/cors');
const { sendError }      = require('./middleware/response');
const { seoMiddleware }  = require('./middleware/seo');
const articlesProxy       = require('./middleware/articlesProxy');

const isProd   = process.env.NODE_ENV === 'production';
const FRONTEND = path.join(__dirname, '../../circle_frontend/frontend');

// ── VAPID setup ───────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@circle.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  global.webpush = webpush;
  console.log('🔔 Web push (VAPID) configured.');
} else {
  console.warn('⚠️  VAPID keys not set — push notifications disabled.');
}

// ── Routes ────────────────────────────────────────────────
const adminRoutes          = require('./routes/adminRoutes');
const userRoutes           = require('./routes/userRoutes');
const postRoutes           = require('./routes/postRoutes');
const followRoutes         = require('./routes/followRoutes');
const notificationRoutes   = require('./routes/notificationRoutes');
const searchRoutes         = require('./routes/searchRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const dmRoutes             = require('./routes/dmRoutes');
const exploreRoutes        = require('./routes/exploreRoutes');
const topicRoutes          = require('./routes/topicRoutes');
const pushRoutes           = require('./routes/pushRoutes');
const groupRoutes          = require('./routes/groupsRoutes');
const phoneAuthRoutes      = require('./routes/phoneAuthRoutes');
const linkPreviewRoutes    = require('./routes/linkpreviewRoutes');
const articleRoutes        = require('./routes/articleRoutes');
const liveRoutes           = require('./routes/liveRoutes');
const whisperRoutes        = require('./routes/whisperRoutes');
const commentRoutes        = require('./routes/commentRoutes');
const adRoutes             = require('./routes/adRoutes');
const videoRoutes          = require('./routes/videoRoutes');

// authRoutes is optional (Google OAuth) — only load if the file exists
let authRoutes = null;
try { authRoutes = require('./routes/authRoutes'); } catch (_) {
  console.log('ℹ️  authRoutes not found — Google OAuth disabled.');
}

// ── App ───────────────────────────────────────────────────
const app = express();

app.use(cors);

// ── Conditional body parsers ─────────────────────────────
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.startsWith('application/json')) {
    return express.json({ limit: '10mb' })(req, res, next);
  }
  if (contentType.startsWith('application/x-www-form-urlencoded')) {
    return express.urlencoded({ limit: '10mb', extended: true })(req, res, next);
  }
  next();
});

// ── JSON parse error handler ─────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  next(err);
});

// Serve uploaded images and videos
app.use('/uploads', express.static('uploads'));

// Dev only: serve frontend static files (prod frontend is on Vercel)
if (!isProd) {
  app.use(express.static(FRONTEND));

  app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(FRONTEND, 'sw.js'));
  });

  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(FRONTEND, 'manifest.json'));
  });

  app.get('/icon.png', (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(path.join(FRONTEND, 'icon.png'));
  });

  app.get('/about', (req, res) => {
    res.redirect(301, 'https://blog.circlenet.social/about')
  });

  app.get('/privacy-policy', (req, res) => {
    res.redirect(301, 'https://blog.circlenet.social/privacy-policy')
  });

  app.get('/contact', (req, res) => {
    res.redirect(301, 'https://blog.circlenet.social/contact')
  });
}

// ── Mount API routes ──────────────────────────────────────
app.use('/api/admin',           adminRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/posts',           postRoutes);
app.use('/api/notifications',   notificationRoutes);
app.use('/api/search',          searchRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/auth/phone',      phoneAuthRoutes);
if (authRoutes) app.use('/api/auth', authRoutes);
app.use('/api',                 followRoutes);
app.use('/api/dm',              dmRoutes);
app.use('/api/explore',         exploreRoutes);
app.use('/api/topics',          topicRoutes);
app.use('/api/push',            pushRoutes);
app.use('/api/groups',          groupRoutes);
app.use('/api/link-preview',    linkPreviewRoutes);
app.use('/api/articles',        articleRoutes);
app.use('/api/live',            liveRoutes);
app.use('/articles',             articlesProxy);
app.use('/_next',                articlesProxy);
app.use('/api/whisper',         whisperRoutes);
app.use('/api/comments',        commentRoutes);
app.use('/api/ads',             adRoutes);
app.use('/api/videos',    videoRoutes);
// ── SEO: bot SSR + sitemap + robots.txt ──────────────────
seoMiddleware(app);

// ── Start crons ───────────────────────────────────────────
const { startGroupCron } = require('./models/groupModel');
startGroupCron();
console.log('Group auto-creation cron started.');

// ── Catch-all for frontend routing ───────────────────────
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(FRONTEND, 'index.html'));
});

module.exports = app;