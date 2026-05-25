import { NextResponse } from '@vercel/edge';

const BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|slackbot|pinterestbot/i;

export function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  const { pathname } = request.nextUrl;

  const isSeoRoute = /^\/(post|profile)\//.test(pathname);
  const isBot = BOT_UA.test(ua);

  if (isSeoRoute && isBot) {
    // Rewrite bot requests to your Railway backend
    return NextResponse.rewrite(
      new URL(pathname, 'https://circleappapp-production.up.railway.app')
    );
  }

  // Let normal users proceed to the static SPA
  return NextResponse.next();
}

export const config = {
  matcher: ['/post/:path*', '/profile/:path*'],
};