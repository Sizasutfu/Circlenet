// src/app/topic/[slug]/page.jsx
import TopicClient from './TopicClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug); // 👈 decode for metadata
  return {
    title: `#${decodedSlug} | Circlenet`,
    description: `Posts tagged with #${decodedSlug} on Circlenet.`,
  };
}

export default async function TopicPage({ params }) {
  const { slug } = await params;
  // Pass the raw slug to the client; let the client decode it.
  // Or decode it here and pass the decoded version:
  const decodedSlug = decodeURIComponent(slug);
  return <TopicClient slug={decodedSlug} />;
}