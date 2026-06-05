export const metadata = {
  title: 'Privacy Policy | Circlenet Articles',
  description:
    'Read the Circlenet Articles privacy policy to learn how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-semibold mb-6">Privacy Policy</h1>
      <p className="text-lg leading-8 mb-4">
        At Circlenet Articles, protecting your privacy is a top priority. We collect only
        the minimum information needed to deliver a safe and personalized experience.
      </p>
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Information We Collect</h2>
          <p className="text-base leading-7">
            We may collect analytics data, browser information, and user preferences to improve
            our site and personalize your experience.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-2">How We Use Data</h2>
          <p className="text-base leading-7">
            Data is used to maintain the blog, enhance performance, and deliver relevant
            content. We do not sell your personal information to third parties.
          </p>
        </div>
      </section>
    </main>
  );
}
