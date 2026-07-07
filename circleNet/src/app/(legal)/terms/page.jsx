import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — Circle',
  description: 'Read the Circle Terms of Service and understand your rights and responsibilities while using the platform.',
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 text-[var(--color-txt)]">
      <nav className="flex flex-wrap gap-4 mb-8 text-sm text-[var(--color-txt2)] border-b border-[var(--color-border)] pb-4">
        <Link href="/" className="hover:text-[var(--color-accent)] transition">
          Home
        </Link>
        <Link href="/about" className="hover:text-[var(--color-accent)] transition">
          About
        </Link>
        <Link href="/privacy-policy" className="hover:text-[var(--color-accent)] transition">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-[var(--color-accent)] transition font-medium text-[var(--color-txt)]">
          Terms of Service
        </Link>
        <Link href="/contact" className="hover:text-[var(--color-accent)] transition">
          Contact
        </Link>
      </nav>

      <h1 className="text-3xl font-head font-bold text-[var(--color-txt)] mb-4">Terms of Service</h1>
      <p className="text-base leading-relaxed text-[var(--color-txt2)] mb-8">
        These Terms of Service govern your use of Circle. By accessing or using Circle, you agree to follow and be bound by these terms.
      </p>

      <section className="space-y-8">
        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">1. Using Circle</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Circle is a social platform for sharing posts, joining groups, and connecting with your community.
            You may use Circle only for lawful purposes and in compliance with these Terms. You agree not to abuse,
            harm, or interfere with the service or other users.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">2. Account registration</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            To use certain features, you may need to create an account. You must provide accurate information,
            protect your login credentials, and are responsible for all activity that occurs under your account.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">3. Content and conduct</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            You retain ownership of the content you post, but you grant Circle a license to host and display it.
            You must not post illegal, abusive, harassing, or infringing content. Respect other members, and follow
            the community rules.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">4. Intellectual property</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Circle owns the platform and its branding. You may not copy, reproduce, or distribute Circle's code,
            design, or trademarks without express permission. Your posted content remains yours, but Circle may use it to
            operate and promote the service.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">5. Privacy</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Your use of Circle is also governed by our <Link href="/privacy-policy" className="text-[var(--color-accent)] hover:underline">Privacy Policy</Link>, which explains how we collect,
            use, and protect your personal information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">6. Disclaimers</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Circle is provided "as is" and "as available." We do not guarantee uninterrupted access, error-free operation,
            or the accuracy of content posted by users. We disclaim all warranties to the fullest extent permitted by law.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">7. Limitation of liability</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            To the extent permitted by law, Circle and its affiliates are not liable for indirect, incidental,
            special, or consequential damages arising from your use of the platform.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">8. Termination</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We may suspend or terminate your access if you violate these Terms, misuse the platform, or engage in harmful activity.
            You may also stop using Circle at any time.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">9. Changes to these terms</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We may update these Terms occasionally. Continued use of Circle after changes means you accept the revised terms.
            Please check this page regularly for updates.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-head font-semibold text-[var(--color-txt)] mb-2">10. Contact</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            If you have questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:support@circlenet.social" className="text-[var(--color-accent)] hover:underline">
              support@circlenet.social
            </a>.
          </p>
        </div>
      </section>
    </main>
  );
}
