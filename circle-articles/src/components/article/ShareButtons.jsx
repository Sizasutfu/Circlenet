'use client';

import { useEffect, useState } from 'react';

export default function ShareButtons({ title }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  if (!url) return null;

  const encode = encodeURIComponent;

  return (
    <div className="art-share" suppressHydrationWarning={true}>
      <span className="art-share-label">Share this article</span>
      <div className="art-share-btns">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encode(url)}`}
          target="_blank"
          rel="noopener"
          className="art-share-btn"
        >
          Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encode(title)}&url=${encode(url)}`}
          target="_blank"
          rel="noopener"
          className="art-share-btn"
        >
          Twitter
        </a>
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${encode(url)}&title=${encode(title)}`}
          target="_blank"
          rel="noopener"
          className="art-share-btn"
        >
          LinkedIn
        </a>
      </div>
    </div>
  );
}