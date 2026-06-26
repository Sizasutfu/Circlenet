// src/app/groups/[id]/page.jsx
import GroupDetailClient from './GroupDetailClient';
import { apiClient } from '@/lib/api';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const res = await apiClient(`/api/groups/${id}`);
    const group = res.data || res;
    return {
      title: `${group.displayName || '#' + group.topic} | Group`,
      description: group.description || `Join the ${group.topic} group on Circlenet.`,
    };
  } catch {
    return { title: 'Group | Circlenet' };
  }
}

export default function GroupDetailPage({ params }) {
  return <GroupDetailClient params={params} />;
}