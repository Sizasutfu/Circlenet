// api/seo.js
import fs from 'fs';
import path from 'path';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { type, id, userId } = req.query;

  // Bot → fetch from Railway
  if (BOT_UA.test(ua)) {
    const // api/seo.js
import fs from 'fs';
import path from 'path';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';
  const { type, id, userId } = req.query;

  // Bot → fetch from Railway
  if (BOT_UA.test(ua)) {
    const railwayPath = type === 'post' ? `/post/${id}` : `/profile/${userId}`;
    const backendUrl = `https://circleappapp-production.up.railway.app${railwayPath}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user → serve index.html from the frontend folder
  const indexPath = path.join(process.cwd(), 'frontend', 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`index.html not found at ${indexPath}: ${err.message}`);
  }
}railwayPath = type === 'post' ? `/post/${id}` : `/profile/${userId}`;
    const backendUrl = `https://circleappapp-production.up.railway.app${railwayPath}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user → serve index.html
  const indexPath = path.join(process.cwd(), 'index.html');
  try {
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    res.status(500).send(`index.html not found: ${err.message}`);
  }
}