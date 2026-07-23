// app/search/page.js
import SearchClient from './SearchClient';

export const metadata = {
  title: 'Search',
  description: 'Search for posts, people, and groups',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function SearchPage() {
  // No need to pass searchParams – the client uses useSearchParams()
  return <SearchClient />;
}