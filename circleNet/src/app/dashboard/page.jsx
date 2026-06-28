// src/app/dashboard/page.jsx
import DashboardClient from './DashboardClient';

export const metadata = {
  title: 'Dashboard | Circlenet',
  description: 'Your activity overview and key metrics.',
};

export default function DashboardPage() {
  return <DashboardClient />;
}