import fs from 'fs';
import path from 'path';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { type, id, userId } = req.query;

  if (BOT_UA.test(ua)) {
    const railwayPath = type === 'post'
      ? `/post/${id}`
      : `/profile/${userId}`;

    const backendUrl = `https://circleappapp-production.up.railway.app${railwayPath}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user — read index.html from disk
  try {
    const indexPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    // Debug: show cwd and files if index.html not found
    const files = fs.readdirSync(process.cwd());
    return res.status(200).json({ error: e.message, cwd: process.cwd(), files });
  }
}