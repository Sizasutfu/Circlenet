// src/app/feed/page.jsx
import FeedClient from './FeedClient';

export const metadata = {
  title: 'Feed | Circlenet',
  description: 'Stay updated with posts from the community',
};

export default function FeedPage() {
  return <FeedClient />;
}