import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export default async function OGImage({ params }) {
  const { slug } = await params;
  let article = null;

  try {
    const res = await fetch(`${backendUrl}/api/articles/by-slug/${slug}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      article = json.data?.article || json.data || json;
    }
  } catch (err) {
    console.error('Failed to fetch article for OG image:', err);
  }

  if (!article) {
    return new ImageResponse(
      <div
        style={{
          background: '#0a0a0d',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          fontFamily: 'sans-serif',
          color: '#eeeef5',
        }}
      >
        404 – Article not found
      </div>,
      size
    );
  }

  const title = article.title || 'Circle Article';
  const author = article.author || 'Circle';
  const coverRaw = article.coverImage || article.cover_image;
  const coverImageUrl = coverRaw && coverRaw.startsWith('/') ? `${backendUrl}${coverRaw}` : coverRaw;

  // Fetch cover image and convert to PNG-compatible base64
  let coverImageData = null;
  if (coverImageUrl) {
    try {
      const imgRes = await fetch(coverImageUrl);
      const contentType = imgRes.headers.get('content-type') || '';
      // Only use if it's a supported format (not webp)
      if (imgRes.ok && !contentType.includes('webp')) {
        const arrayBuffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        coverImageData = `data:${contentType};base64,${base64}`;
      }
    } catch (err) {
      console.error('Failed to fetch cover image:', err);
    }
  }

  const truncatedTitle = title.length > 90 ? title.slice(0, 87) + '...' : title;

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0a0a0d 0%, #16161c 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          position: 'relative',
          fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
        }}
      >
        {coverImageData && (
          <img
            src={coverImageData}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.15,
            }}
          />
        )}

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div
              style={{
                background: '#7c6bff',
                width: 48,
                height: 48,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(124,107,255,0.3)',
              }}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="white">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <span style={{ fontSize: 28, fontWeight: 600, color: '#9090aa' }}>Circle Blog</span>
          </div>

          <div style={{ flex: 1 }} />

          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: '#eeeef5',
              lineHeight: 1.2,
              marginBottom: 30,
              maxWidth: '90%',
              letterSpacing: '-0.02em',
            }}
          >
            {truncatedTitle}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: '#7c6bff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              {author.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#eeeef5' }}>{author}</div>
              <div style={{ fontSize: 20, color: '#9090aa' }}>
                {article.createdAt
                  ? new Date(article.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Just now'}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}