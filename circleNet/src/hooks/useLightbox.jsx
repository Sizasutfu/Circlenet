// src/hooks/useLightbox.js
'use client';

import { createContext, useContext, useState } from 'react';

const LightboxContext = createContext();

export function LightboxProvider({ children }) {
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    initialIndex: 0,
  });

  const openLightbox = (images, initialIndex = 0) => {
    const imageArray = Array.isArray(images) ? images : [images];
    setLightboxState({
      isOpen: true,
      images: imageArray,
      initialIndex,
    });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

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