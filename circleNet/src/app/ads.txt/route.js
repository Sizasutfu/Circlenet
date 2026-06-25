export async function GET() {
  const responseText = 'google.com, pub-pub-1816934530564614, DIRECT, f08c47fec0942fa0';

  return new Response(responseText, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  });
}
