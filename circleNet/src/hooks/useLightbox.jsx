// src/hooks/useLightbox.js
'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const LightboxContext = createContext();

export function LightboxProvider({ children }) {
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
  });

  const openLightbox = useCallback((images, initialIndex = 0) => {
    const imageArray = Array.isArray(images) ? images : [images];
    // Normalize: if string, convert to object
    const normalized = imageArray.map((img) => {
      if (typeof img === 'string') {
        return { src: img, type: 'image', meta: {} };
      }
      return img;
    });
    setLightboxState({
      isOpen: true,
      images: normalized,
      initialIndex,
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <LightboxContext.Provider value={{ lightboxState, openLightbox, closeLightbox }}>
      {children}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error('useLightbox must be used within a LightboxProvider');
  }
  return context;
}