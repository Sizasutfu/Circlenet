import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Circlenet Articles',
  description:
    'Explore the Circlenet article directory and discover the latest stories, tutorials, and community content.',
  alternates: {
    canonical: '/articles',
  },
};

export default function HomePage() {
  redirect('/articles');
}