// src/app/layout.jsx
import './globals.css';
import Providers from './Providers';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

export const metadata = {
  title: {
    default: 'Circlenet',
    template: '%s | Circlenet',
  },
  description:
    'Circlenet Articles is a modern blog for community stories, tutorials, and insights about social publishing.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://blog.circlenet.social'),
  openGraph: {
    title: 'Circlenet',
    description:
      'Circlenet Articles is a modern blog for community stories, tutorials, and insights about social publishing.',
    siteName: 'Circlenet',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Circlenet',
    description:
      'Circlenet Articles is a modern blog for community stories, tutorials, and insights about social publishing.',
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
      </head>
      <body className="bg-bg text-txt font-body antialiased">
        <Providers>
          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}