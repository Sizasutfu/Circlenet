// src/components/ui/Lightbox.jsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function Lightbox({ images, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const currentImage = images[currentIndex] || '';
  const total = images.length;

  // ── Keyboard navigation ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && total > 1) goPrev();
      if (e.key === 'ArrowRight' && total > 1) goNext();
      if (e.key === '-' || e.key === '_') zoomOut();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === 'r' || e.key === 'R') resetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [total, currentIndex]);

  // ── Prevent body scroll ──
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // ── Navigation ──
  const goNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      resetZoom();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetZoom();
    }
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const zoomIn = () => setScale(Math.min(scale + 0.25, 3));
  const zoomOut = () => setScale(Math.max(scale - 0.25, 0.5));

  // ── Mouse drag (pan) ──
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartPosition({ x: position.x, y: position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPosition({
      x: startPosition.x + dx,
      y: startPosition.y + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // ── Touch drag ──
  const handleTouchStart = (e) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setStartPosition({ x: position.x, y: position.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;
    setPosition({
      x: startPosition.x + dx,
      y: startPosition.y + dy,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // ── Click backdrop to close ──
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── Render portal ──
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center select-none"
      onClick={handleBackdropClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition z-10 p-2"
        aria-label="Close lightbox"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 rounded-full px-3 py-2">
        <button onClick={zoomOut} className="text-white hover:text-gray-300" aria-label="Zoom out">−</button>
        <span className="text-white text-sm px-2">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} className="text-white hover:text-gray-300" aria-label="Zoom in">+</button>
        <button onClick={resetZoom} className="text-white hover:text-gray-300 text-sm ml-2">⟲</button>
      </div>

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <img
          src={currentImage}
          alt="Lightbox"
          className="transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            maxWidth: '90vw',
            maxHeight: '90vh',
            objectFit: 'contain',
          }}
          draggable={false}
        />
      </div>

      {/* Navigation arrows (if multiple images) */}
      {total > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition p-2 bg-black/30 rounded-full"
            aria-label="Previous image"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition p-2 bg-black/30 rounded-full"
            aria-label="Next image"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {currentIndex + 1} / {total}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}