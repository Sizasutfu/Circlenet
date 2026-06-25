// src/app/settings/page.jsx
import SettingsClient from './SettingsClient';

export const metadata = {
  title: 'Settings | Circlenet',
  description: 'Manage your profile and preferences',
};

export default function SettingsPage() {
  return <SettingsClient />;
}