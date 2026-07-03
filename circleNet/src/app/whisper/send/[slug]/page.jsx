// src/app/whisper/send/[slug]/page.jsx
import WhisperSendClient from './WhisperSendClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return {
    title: `Send a whisper | Circlenet`,
    description: `Send an anonymous message on Circlenet.`,
  };
}

export default async function WhisperSendPage({ params }) {
  const { slug } = await params;
  return <WhisperSendClient slug={slug} />;
}