// src/app/layout.jsx
import './globals.css';
import Providers from './Providers';
import ClientLayout from './ClientLayout';

export const metadata = {
  title: {
    default: 'Circlenet',
    template: '%s | Circlenet',
  },
  description:
    'Circlenet is a modern platform for articles, live streams, and real‑time conversations. Join the community today.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://www.circlenet.social'),
  openGraph: {
    title: 'Circlenet',
    description:
      'Circlenet is a modern platform for articles, live streams, and real‑time conversations. Join the community today.',
    siteName: 'Circlenet',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Circlenet',
    description:
      'Circlenet is a modern platform for articles, live streams, and real‑time conversations. Join the community today.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1816934530564614"
          crossOrigin="anonymous"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-bg text-txt font-body antialiased">
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}