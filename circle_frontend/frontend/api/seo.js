// api/seo.js
import fs from 'fs';
import path from 'path';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { type, id, userId } = req.query;

  if (BOT_UA.test(ua)) {
    // Bot: fetch pre-rendered HTML from Railway
    const railwayPath = type === 'post' ? `/post/${id}` : `/profile/${userId}`;
    const backendUrl = `https://circleappapp-production.up.railway.app${railwayPath}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user: serve index.html from the correct location
  // On Vercel, static assets are in the 'public' folder or at the root.
  // Try multiple possible paths:
  const possiblePaths = [
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), 'public', 'index.html'),
    path.join(process.cwd(), 'static', 'index.html'),
  ];
  
  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }
  }
  
  // If still not found, return error with debug info
  const files = fs.readdirSync(process.cwd());
  res.status(500).json({ error: 'index.html not found', cwd: process.cwd(), files });
}