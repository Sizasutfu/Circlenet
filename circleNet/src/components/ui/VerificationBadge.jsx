// src/components/ui/VerificationBadge.jsx
'use client';

export default function VerificationBadge({ size = 'w-4 h-4', className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center text-blue-500 flex-shrink-0 ${className}`}
      title="Verified account"
    >
      <svg
        className={`${size} fill-current`}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </span>
  );
}