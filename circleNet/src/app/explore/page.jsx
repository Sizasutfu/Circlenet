// src/app/explore/page.jsx
import ExploreClient from './ExploreClient';

export const metadata = {
  title: 'Explore | Circlenet',
  description: 'Discover trending posts, topics, and people on Circlenet.',
};

export default function ExplorePage() {
  return <ExploreClient />;
}