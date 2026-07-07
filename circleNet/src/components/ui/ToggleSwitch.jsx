// src/components/ui/ToggleSwitch.jsx
'use client';

export default function ToggleSwitch({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-[var(--color-border2)] rounded-full peer peer-checked:bg-[var(--color-accent)] transition-colors duration-200 shadow-inner"></div>
        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 peer-checked:translate-x-5 shadow-sm peer-disabled:opacity-50"></div>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-[var(--color-txt)] font-medium">{label}</span>
        {description && <p className="text-xs text-[var(--color-txt3)]">{description}</p>}
      </div>
    </label>
  );
}