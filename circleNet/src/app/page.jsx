// src/app/page.jsx
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Feed | Circlenet',
  description: 'Explore the Circlenet article directory and discover the latest stories, insights, and tutorials from the community.',
  alternates: {
    canonical: '/feed',
  },
};

export default function HomePage() {
  redirect('/feed');
}