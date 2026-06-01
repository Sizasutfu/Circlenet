// src/app/layout.jsx
import './globals.css'; 
import Providers from './Providers';  // ✅

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}