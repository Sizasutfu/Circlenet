// src/app/ClientLayout.jsx
'use client';

import { Suspense, useState } from 'react';
import { AuthProvider } from '@/lib/auth';
import { DmProvider } from '@/contexts/DmContext';
import { WhisperProvider } from '@/contexts/WhisperContext';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { ExploreProvider } from '@/contexts/ExploreContext';
import { LiveProvider } from '@/contexts/LiveContext'; // 👈 Live
import { NotificationProvider } from '@/contexts/NotificationContext';
import NotificationPanel from '@/components/notification/NotificationPanel';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SideBar from '@/components/layout/SideBar';
import { LightboxProvider } from '@/hooks/useLightbox';
import Lightbox from '@/components/ui/Lightbox';
import { useLightbox } from '@/hooks/useLightbox';
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

export default function ClientLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <AuthProvider>
      <DmProvider>
        <WhisperProvider>
          <GroupsProvider>
            <SearchProvider>
              <ExploreProvider>
                <LiveProvider>   {/* 👈 Live provider wraps everything that needs live context */}
                  <NotificationProvider>
                    <LightboxProvider>
                      <LightboxWrapper>
                        <div className="flex min-h-screen">
                          <SideBar isOpen={sidebarOpen} onClose={closeSidebar} />
                          <div className="flex-1 flex flex-col min-h-screen md:ml-[260px]">
                            <Suspense fallback={<div className="h-14" />}>
                              <Header onMenuClick={toggleSidebar} />
                            </Suspense>
                            <main className="flex-1 px-4 sm:px-6 py-4">
                              {/* Live feed strip – shown on all pages */}
                              <LiveFeedStrip />
                              {children}
                            </main>
                            <Footer />
                          </div>
                        </div>
                        <NotificationPanel />
                        {/* Live modals/overlays (rendered outside main layout) */}
                        <LiveSetupModal />
                        <LiveOverlay />
                        <LiveToast />
                      </LightboxWrapper>
                    </LightboxProvider>
                  </NotificationProvider>
                </LiveProvider>
              </ExploreProvider>
            </SearchProvider>
          </GroupsProvider>
        </WhisperProvider>
      </DmProvider>
    </AuthProvider>
  );
}