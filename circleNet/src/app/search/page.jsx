// src/app/search/page.jsx
import SearchClient from './SearchClient';

export const metadata = {
  title: 'Search | Circlenet',
  description: 'Search posts, people, and groups on Circlenet.',
};

export default function SearchPage({ searchParams }) {
  return <SearchClient searchParams={searchParams} />;
}