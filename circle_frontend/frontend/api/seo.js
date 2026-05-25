const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export default async function handler(req, res) {
  const ua = req.headers['user-agent'] || '';

  if (BOT_UA.test(ua)) {
    // Proxy to Railway for SEO HTML
    const backendUrl = `https://circleappapp-production.up.railway.app${req.url}`;
    const response = await fetch(backendUrl, { headers: { 'user-agent': ua } });
    const html = await response.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(response.status).send(html);
  }

  // Real user — fetch and serve index.html so the SPA loads at the correct URL
  const origin = `https://${req.headers.host}`;
  const response = await fetch(`${origin}/index.html`);
  const html = await response.text();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}