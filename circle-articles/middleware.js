import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = request.headers.get('host') || '';
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // Skip middleware for internal Next.js assets and API routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // If the request was proxied by our backend, skip the redirect to avoid loops
  if (request.headers.get('x-proxied-by')) {
    return NextResponse.next();
  }

  // Redirect blog.circlenet.social -> www.circlenet.social (preserve path + query)
  if (host === 'blog.circlenet.social' || host.startsWith('blog.circlenet.social:')) {
    url.hostname = 'www.circlenet.social';
    url.protocol = 'https';
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // apply to all paths
  matcher: '/:path*',
};
