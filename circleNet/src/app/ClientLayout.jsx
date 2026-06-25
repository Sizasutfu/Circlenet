// src/app/ClientLayout.jsx
'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@/lib/auth';
import { DmProvider } from '@/contexts/DmContext';
import { WhisperProvider } from '@/contexts/WhisperContext'; // 👈 new import
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SideBar from '@/components/layout/SideBar';
import { LightboxProvider } from '@/hooks/useLightbox';
import Lightbox from '@/components/ui/Lightbox';
import { useLightbox } from '@/hooks/useLightbox';

function LightboxWrapper({ children }) {
  const { lightboxState, closeLightbox } = useLightbox();
  return (
    <>
      {children}
      {lightboxState.isOpen && (
        <Lightbox
          images={lightboxState.images}
          initialIndex={lightboxState.initialIndex}
          onClose={closeLightbox}
        />
      )}
    </>
  );
}

export default function ClientLayout({ children }) {
  return (
    <AuthProvider>
      <DmProvider>
        <WhisperProvider> {/* 👈 wrap here */}
          <LightboxProvider>
            <LightboxWrapper>
              <div className="flex min-h-screen">
                <SideBar />
                <div className="flex-1 ml-[260px] flex flex-col">
                  <Suspense fallback={<div className="h-14" />}>
                    <Header />
                  </Suspense>
                  <main className="flex-1 px-6 py-4">{children}</main>
                  <Footer />
                </div>
              </div>
            </LightboxWrapper>
          </LightboxProvider>
        </WhisperProvider>
      </DmProvider>
    </AuthProvider>
  );
}