// src/components/ui/ReasonBadge.jsx
'use client';

export default function ReasonBadge({ reasons, className = '' }) {
  if (!reasons || reasons.length === 0) return null;
  
  const primary = reasons[0];
  const extra = reasons.length - 1;
  
  return (
    <span className={`text-[10px] bg-[var(--color-accent-bg)] text-[var(--color-accent)] px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}>
      {primary}
      {extra > 0 && ` +${extra} more`}
    </span>
  );
}