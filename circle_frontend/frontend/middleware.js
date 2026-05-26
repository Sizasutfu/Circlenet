// middleware.js for plain static site on Vercel
const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export async function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const { pathname, search } = new URL(request.url);

  const isSeoRoute = /^\/(post|profile)\//.test(pathname);
  const isBot = BOT_UA.test(ua);

  if (isSeoRoute && isBot) {
    // Fetch the content from your Railway backend and return it
    const backendUrl = `https://circleappapp-production.up.railway.app${pathname}${search}`;
    const response = await fetch(backendUrl);
    // Return the exact response (status, headers, body)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  // For normal users, do nothing (serve the static file)
  return;
}

export const config = {
  matcher: ['/post/:path*', '/profile/:path*'],
};