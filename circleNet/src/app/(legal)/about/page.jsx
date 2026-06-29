// src/app/about/page.jsx
export const metadata = {
  title: 'About | Circlenet',
  description:
    'Circlenet is a modern social platform built by Siza Mndzawe in Eswatini. Connect, share, and grow your community with posts, groups, live streams, whispers, and articles.',
};

export default function AboutPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-head font-bold text-[var(--color-txt)] mb-6">About Circlenet</h1>

      <p className="text-lg leading-relaxed text-[var(--color-txt2)] mb-6">
        Circlenet is a modern social platform built for real connections – created by <strong className="text-[var(--color-txt)]">Siza Mndzawe</strong> in the beautiful Kingdom of <strong className="text-[var(--color-txt)]">Eswatini</strong>.
        Whether you're sharing a moment, joining a group conversation, discovering trending topics, or
        publishing your thoughts, Circlenet brings it all together in a seamless, community‑driven experience.
      </p>

      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-head font-semibold text-[var(--color-txt)] mb-2">Our Mission</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            We believe in creating a space where people can express themselves freely,
            connect with others who share their interests, and build meaningful communities.
            Circlenet is designed to be inclusive, respectful, and empowering for everyone.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-head font-semibold text-[var(--color-txt)] mb-2">What You Can Do</h2>
          <ul className="list-disc pl-6 text-base leading-relaxed text-[var(--color-txt2)] space-y-1">
            <li><strong className="text-[var(--color-txt)]">Share posts</strong> – text, images, and video with your network.</li>
            <li><strong className="text-[var(--color-txt)]">Join groups</strong> – topic‑based communities to discuss what matters to you.</li>
            <li><strong className="text-[var(--color-txt)]">Explore</strong> – discover trending topics, people, and new members.</li>
            <li><strong className="text-[var(--color-txt)]">Whisper anonymously</strong> – send and receive anonymous messages.</li>
            <li><strong className="text-[var(--color-txt)]">Go live</strong> – stream to your audience with chat and reactions.</li>
            <li><strong className="text-[var(--color-txt)]">Read articles</strong> – in‑depth stories and guides from the community.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-head font-semibold text-[var(--color-txt)] mb-2">A Growing Community</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Circlenet is built by and for its users. We are constantly evolving,
            listening to feedback, and adding features that help people connect,
            create, and thrive. Whether you're a creator, a reader, or someone
            looking for a new community, you'll find a home here.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-head font-semibold text-[var(--color-txt)] mb-2">🇸🇿 Made in Eswatini</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Circlenet was born in the heart of Eswatini – a small but vibrant kingdom
            with a rich culture and a growing tech community. We're proud of our roots
            and aim to bring that same warmth, creativity, and innovation to the world.
            From Eswatini to the world, we're building a platform that connects people
            across borders.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-head font-semibold text-[var(--color-txt)] mb-2">Join Us</h2>
          <p className="text-base leading-relaxed text-[var(--color-txt2)]">
            Ready to be part of something meaningful? <a href="/register" className="text-[var(--color-accent)] hover:underline">Sign up</a> today,
            explore the platform, and start connecting with people who share your passions.
          </p>
        </section>
      </div>
    </main>
  );
}