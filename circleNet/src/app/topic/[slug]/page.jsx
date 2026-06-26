// src/app/topic/[slug]/page.jsx
import TopicClient from './TopicClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `#${slug} | Circlenet`,
    description: `Posts tagged with #${slug} on Circlenet.`,
  };
}

export default async function TopicPage({ params }) {
  const { slug } = await params;      // 👈 await the promise
  return <TopicClient slug={slug} />; // 👈 pass resolved slug
}