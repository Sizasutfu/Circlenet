// src/app/whisper/inbox/page.jsx
import WhisperInboxClient from './WhisperInboxClient';

export const metadata = {
  title: 'Whisper Inbox | Circlenet',
  description: 'Manage anonymous messages from your audience.',
};

export default function WhisperInboxPage() {
  return <WhisperInboxClient />;
}