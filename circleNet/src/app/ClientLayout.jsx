// src/app/ClientLayout.jsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // 👈 added
import { AuthProvider } from '@/lib/auth';
import { WsProvider } from '@/contexts/WsContext';
import { DmProvider } from '@/contexts/DmContext';
import { WhisperProvider } from '@/contexts/WhisperContext';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { ExploreProvider } from '@/contexts/ExploreContext';
import { LiveProvider } from '@/contexts/LiveContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PushProvider } from '@/contexts/PushContext';
import { LightboxProvider } from '@/hooks/useLightbox';
import Lightbox from '@/components/ui/Lightbox';
import { useLightbox } from '@/hooks/useLightbox';
import NotificationPanel from '@/components/notification/NotificationPanel';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SideBar from '@/components/layout/SideBar';
import MobileNavbar from '@/components/layout/MobileNavbar';
import LiveSetupModal from '@/components/live/LiveSetupModal';
import LiveOverlay from '@/components/live/LiveOverlay';
import LiveFeedStrip from '@/components/live/LiveFeedStrip';
import LiveToast from '@/components/live/LiveToast';

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

function FloatingComposeButton() {
  const router = useRouter(); // ✅ now defined
  return (
    <button
      onClick={() => router.push('/compose')}
      className="fixed bottom-20 right-4 z-40 bg-[var(--color-accent)] text-white rounded-full p-4 shadow-lg shadow-[var(--color-accent-glow)] hover:bg-[var(--color-accent-h)] transition transform hover:scale-105 md:hidden"
      aria-label="Create post"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
  );
}

export default function ClientLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Register service worker for push
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('✅ SW registered:', reg))
        .catch((err) => console.warn('❌ SW registration failed:', err));
    }
  }, []);

  return (
    <AuthProvider>
      <WsProvider>
        <PushProvider>
          <DmProvider>
            <WhisperProvider>
              <GroupsProvider>
                <SearchProvider>
                  <ExploreProvider>
                    <LiveProvider>
                      <NotificationProvider>
                        <LightboxProvider>
                          <LightboxWrapper>
                            <div className="flex min-h-screen">
                              <SideBar isOpen={sidebarOpen} onClose={closeSidebar} />
                              <div className="flex-1 flex flex-col min-h-screen md:ml-[260px]">
                                <Suspense fallback={<div className="h-14" />}>
                                  <Header onMenuClick={toggleSidebar} />
                                </Suspense>
                                <main className="flex-1 px-3 sm:px-6 py-4 pb-20 md:pb-4">
                                  <LiveFeedStrip />
                                  {children}
                                </main>
                                <Footer />
                              </div>
                            </div>
                            <NotificationPanel />
                            <LiveSetupModal />
                            <LiveOverlay />
                            <LiveToast />
                            <FloatingComposeButton />
                            <MobileNavbar />
                          </LightboxWrapper>
                        </LightboxProvider>
                      </NotificationProvider>
                    </LiveProvider>
                  </ExploreProvider>
                </SearchProvider>
              </GroupsProvider>
            </WhisperProvider>
          </DmProvider>
        </PushProvider>
      </WsProvider>
    </AuthProvider>
  );
}