// src/app/layout.jsx
import './globals.css';
import Providers from './Providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-txt font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}