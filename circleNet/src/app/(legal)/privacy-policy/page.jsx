// src/app/privacy-policy/page.jsx
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Circle',
  description: 'Read Circle\'s privacy policy and how we protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-[var(--color-txt)]">
      {/* Navigation (inline, matches your HTML structure) */}
      <nav className="flex flex-wrap gap-4 mb-8 text-sm text-[var(--color-txt2)] border-b border-[var(--color-border)] pb-4">
        <Link href="/" className="hover:text-[var(--color-accent)] transition">
          Home
        </Link>
        <Link href="/about" className="hover:text-[var(--color-accent)] transition">
          About
        </Link>
        <Link href="/privacy-policy" className="hover:text-[var(--color-accent)] transition font-medium text-[var(--color-txt)]">
          Privacy Policy
        </Link>
        <Link href="/contact" className="hover:text-[var(--color-accent)] transition">
          Contact
        </Link>
      </nav>

      <h1 className="text-3xl font-head font-bold text-[var(--color-txt)] mb-4">Privacy Policy</h1>
      <p className="text-base leading-relaxed text-[var(--color-txt2)] mb-8">
        At Circle, we take your privacy seriously. This policy explains what information we collect,
        how we use it, and how we protect your data.
      </p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">Information we collect</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We collect information that helps us operate the platform and provide a better experience,
            including account details, profile information, posts, interactions, and usage data.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">How we use your data</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We use your information to provide services, personalize your experience, improve platform security,
            and communicate important updates. We do not sell your personal information.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">Security and control</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We use industry-standard protections and allow you to manage your account settings.
            You can control what information is visible on your profile and how you receive notifications.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">Contact us</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            If you have questions about privacy, please contact us at{' '}
            <a href="mailto:support@circlenet.social" className="text-[var(--color-accent)] hover:underline">
              support@circlenet.social
            </a>.
          </p>
        </div>
      </section>
    </main>
  );
}