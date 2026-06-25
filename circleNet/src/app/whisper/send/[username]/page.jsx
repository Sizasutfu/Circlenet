// src/app/whisper/send/[username]/page.jsx
import WhisperSendClient from './WhisperSendClient';

export async function generateMetadata({ params }) {
  const { username } = await params;
  return {
    title: `Send a whisper to @${username} | Circlenet`,
    description: `Send an anonymous message to @${username} on Circlenet.`,
  };
}

export default async function WhisperSendPage({ params }) {
  const { username } = await params;
  return <WhisperSendClient username={username} />;
}