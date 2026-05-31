'use client';
import { usePathname } from 'next/navigation';

export default function ShareButtons({ title }) {
  const pathname = usePathname();
  const url = typeof window !== 'undefined' ? window.location.href : `http://blog.circlenet.social${pathname}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="art-share" suppressHydrationWarning>
      <span className="art-share-label">Share this article</span>
      <div className="art-share-btns">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener"
          className="art-share-btn"
        >
          Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
          target="_blank"
          rel="noopener"
          className="art-share-btn"
        >
          Twitter
        </a>
        <a
          href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`}
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