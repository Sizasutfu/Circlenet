export const metadata = {
  title: 'Contact | Circlenet Articles',
  description:
    'Get in touch with the Circlenet Articles team for feedback, questions, or partnership inquiries.',
};

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-semibold mb-6">Contact Us</h1>
      <p className="text-lg leading-8 mb-8">
        Have a question, feedback, or partnership inquiry? Send us a message and we&apos;ll
        get back to you shortly.
      </p>
      <form className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="w-full rounded border px-4 py-3"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full rounded border px-4 py-3"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows="6"
            className="w-full rounded border px-4 py-3"
            placeholder="Tell us what you need"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded bg-slate-900 px-6 py-3 text-white hover:bg-slate-800"
        >
          Send Message
        </button>
      </form>
    </main>
  );
}
