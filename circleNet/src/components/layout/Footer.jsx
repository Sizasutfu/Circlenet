// src/components/layout/Footer.jsx
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

// ── SVG Icons ──
const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const GlobeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const HashtagIcon = () => (
  <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M4 9l11-2 1 8-11 2-1-8z" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M22 7l-10 6L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const LightningIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);

const CoffeeIcon = () => (
  <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
    <line x1="6" y1="1" x2="6" y2="4" />
    <line x1="10" y1="1" x2="10" y2="4" />
    <line x1="14" y1="1" x2="14" y2="4" />
  </svg>
);

// ── Main Footer Component ──
export default function Footer() {
  const year = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

  // ── Fetch trending topics ──
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await apiClient('/api/topics?limit=4');
        const topics = res.data || [];
        setTrendingTopics(topics);
      } catch (err) {
        console.warn('Failed to fetch trending topics:', err);
        setTrendingTopics([]);
      } finally {
        setTopicsLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[var(--color-border)] mt-12 py-10 text-[var(--color-txt3)] text-sm">
      <div className="max-w-screen-xl mx-auto px-4">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <p className="font-head font-bold text-lg text-[var(--color-txt)] mb-2">CircleNet</p>
            <p className="text-[var(--color-txt2)] leading-relaxed max-w-xs">
              Where real connections happen. Share moments, join conversations, and grow your community.
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-[var(--color-txt3)]">
              <span className="flex items-center gap-1"><LockIcon /> SSL Secured</span>
              <span className="flex items-center gap-1"><ShieldIcon /> Privacy Protected</span>
              <span className="flex items-center gap-1"><LightningIcon /> 99.9% Uptime</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-[var(--color-txt)] mb-3">Product</h3>
            <ul className="space-y-2">
              <li><Link href="/feed" className="hover:text-[var(--color-accent)] transition">Feed</Link></li>
              <li><Link href="/explore" className="hover:text-[var(--color-accent)] transition">Explore</Link></li>
              <li><Link href="/groups" className="hover:text-[var(--color-accent)] transition">Groups</Link></li>
              <li><Link href="/whisper/inbox" className="hover:text-[var(--color-accent)] transition">Whisper</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-[var(--color-txt)] mb-3">Company</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="hover:text-[var(--color-accent)] transition">About</Link></li>
              <li><Link href="/contact" className="hover:text-[var(--color-accent)] transition">Contact</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-[var(--color-accent)] transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[var(--color-accent)] transition">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Social + Language + Trending */}
          <div>
            <h3 className="font-semibold text-[var(--color-txt)] mb-3">Follow Us</h3>
            <div className="flex gap-4 mb-4">
              <a
                href="https://twitter.com/sbeats15214647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
                aria-label="Twitter"
                title='Follow us on X'
              >
                <TwitterIcon />
              </a>
              <a
                href="https://github.com/sizasutfu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
                aria-label="GitHub"
                title='Follow us on Github'
              >
                <GitHubIcon />
              </a>
              <a
                href="https://www.youtube.com/c/circlenet"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition"
                aria-label="YouTube"
                title='Subscribe on our youtube channel'
              >
                <YouTubeIcon />
              </a>
            </div>

            {/* Language selector */}
            <div className="mb-3">
              <div className="relative inline-block">
                <select
                  className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded pl-7 pr-3 py-1.5 text-sm text-[var(--color-txt)] focus:outline-none focus:border-[var(--color-accent)] appearance-none w-full max-w-[140px]"
                  defaultValue="en"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="si">Siswati</option>
                  <option value="zu">IsiZulu</option>
                </select>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-txt3)]"><GlobeIcon /></span>
              </div>
            </div>

            {/* Trending topics */}
            <div>
              <p className="text-xs font-medium text-[var(--color-txt2)] uppercase tracking-wider mb-1 flex items-center gap-1">
                <HashtagIcon /> Trending
              </p>
              <div className="flex flex-wrap gap-2">
                {topicsLoading ? (
                  <span className="text-xs text-[var(--color-txt3)]">Loading…</span>
                ) : trendingTopics.length === 0 ? (
                  <span className="text-xs text-[var(--color-txt3)]">No trending topics</span>
                ) : (
                  trendingTopics.map((topic) => (
                    <Link
                      key={topic.topic}
                      href={`/topic/${encodeURIComponent(topic.topic)}`}
                      className="text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition text-xs flex items-center"
                    >
                      <HashtagIcon /> {topic.topic}
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter signup */}
        <div className="border-t border-[var(--color-border)] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <p className="text-[var(--color-txt2)] text-sm font-medium flex items-center gap-1">
              <MailIcon /> Subscribe to updates
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2 w-full sm:w-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 sm:w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-1.5 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:outline-none focus:border-[var(--color-accent)]"
                required
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[var(--color-accent)] text-white rounded text-sm font-medium hover:bg-[var(--color-accent-h)] transition whitespace-nowrap"
              >
                {subscribed ? ' Subscribed! ✅' : 'Subscribe'}
              </button>
            </form>
          </div>

          {/* Back to top */}
          <button
            onClick={scrollToTop}
            className="text-[var(--color-txt3)] hover:text-[var(--color-accent)] transition text-sm flex items-center gap-1"
          >
            <ArrowUpIcon /> Back to top
          </button>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--color-border)] mt-6 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--color-txt3)] gap-2">
          <p>© {year} CircleNet. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-[var(--color-accent)] transition">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--color-accent)] transition">Terms</Link>
            <Link href="/contact" className="hover:text-[var(--color-accent)] transition">Support</Link>
            <span className="text-[var(--color-txt3)] flex items-center gap-1">
              Made with <HeartIcon /> and <CoffeeIcon />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}