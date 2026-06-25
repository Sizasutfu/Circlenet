// src/components/ui/OtpInput.jsx
'use client';

import { useRef, useEffect } from 'react';

export default function OtpInput({ prefix, length = 6, onComplete }) {
  const inputsRef = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputsRef.current[0]) {
      inputsRef.current[0].focus();
    }
  }, []);

  const handleInput = (e, index) => {
    const el = e.target;
    el.value = el.value.replace(/\D/g, '').slice(-1);
    el.classList.toggle('filled', !!el.value);

    if (el.value && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Check if all filled
    const allFilled = inputsRef.current.every((input) => input.value.length === 1);
    if (allFilled && onComplete) {
      const code = inputsRef.current.map((input) => input.value).join('');
      onComplete(code);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = inputsRef.current.map((input) => input.value).join('');
      if (code.length === length && onComplete) onComplete(code);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length);

    text.split('').forEach((char, i) => {
      if (inputsRef.current[i]) {
        inputsRef.current[i].value = char;
        inputsRef.current[i].classList.add('filled');
      }
    });

    const lastFilled = Math.min(text.length, length - 1);
    if (inputsRef.current[lastFilled]) {
      inputsRef.current[lastFilled].focus();
    }

    if (text.length === length && onComplete) {
      onComplete(text);
    }
  };

  return (
    <div
      id={`${prefix}-otp-group`}
      className="flex gap-2 justify-center"
      onPaste={handlePaste}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          className="otp-digit w-12 h-14 text-center text-xl font-semibold rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
          onChange={(e) => handleInput(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
        />
      ))}
    </div>
  );
}