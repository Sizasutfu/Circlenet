import fs from 'fs';
import path from 'path';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';

  if (BOT_UA.test(ua)) {
    const backendUrl = `https://circleappapp-production.up.railway.app${req.url}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user — read index.html from disk and serve it
  const indexPath = path.join(process.cwd(), 'index.html');
  const html = fs.readFileSync(indexPath, 'utf-8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}