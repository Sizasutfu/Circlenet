// app/layout.jsx
import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata = {
  title: 'Circle · Immersive Stories',
  description: 'Explore insightful articles from the Circle community.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}