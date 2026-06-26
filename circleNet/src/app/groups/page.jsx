// src/app/groups/page.jsx
import GroupsClient from './GroupsClient';

export const metadata = {
  title: 'Groups | Circlenet',
  description: 'Discover and join topic-based groups on Circlenet.',
};

export default function GroupsPage() {
  return <GroupsClient />;
}