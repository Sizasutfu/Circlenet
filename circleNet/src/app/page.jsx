// src/app/page.jsx
import LandingPage from '@/components/LandingPage';

export const metadata = {
  title: 'Circlenet – Social Publishing & Community',
  description:
    'Circlenet is a modern platform for articles, live streams, and real‑time conversations. Join the community today.',
};

export default function HomePage() {
  return <LandingPage />;
}