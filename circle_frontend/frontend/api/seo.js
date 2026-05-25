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

  // Debug: show what files are available
  const cwd = process.cwd();
  const files = fs.readdirSync(cwd);
  return res.status(200).json({ cwd, files });
}