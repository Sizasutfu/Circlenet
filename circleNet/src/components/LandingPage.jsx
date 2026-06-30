// src/components/LandingPage.jsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <h1 className="text-5xl md:text-7xl font-head font-bold tracking-tight mb-4">
          Welcome to{' '}
          <span className="text-accent bg-accent-bg px-2 rounded-xl">
            Circlenet
          </span>
        </h1>
        <p className="text-txt2 text-lg md:text-xl max-w-2xl mx-auto mb-8">
          A modern social platform for communities, stories, and real‑time
          conversations. Share your world, connect with others.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => router.push('/register')}
            className="px-8 py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent-h transition-all shadow-lg shadow-accent-glow"
          >
            Get Started
          </button>
          <Link
            href="/feed"
            className="px-8 py-3 border border-border2 rounded-lg hover:bg-surface transition-colors"
          >
            Explore Feed
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-surface py-16 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="💬"
            title="Real‑time Chat"
            desc="Instant messaging with DMs, group chats, and whispers – all powered by WebSockets."
          />
          <FeatureCard
            icon="📝"
            title="Articles & Stories"
            desc="Publish long‑form content, tutorials, and insights. Your voice matters."
          />
          <FeatureCard
            icon="🔴"
            title="Live Streams"
            desc="Go live and interact with your audience in real time with integrated live features."
          />
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="py-8 text-center text-txt2 border-t border-border">
        <p>© {new Date().getFullYear()} Circlenet. Built with ❤️</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-card p-6 rounded-radius border border-border hover:border-accent transition-all">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-head font-semibold mb-2">{title}</h3>
      <p className="text-txt2 text-sm">{desc}</p>
    </div>
  );
}