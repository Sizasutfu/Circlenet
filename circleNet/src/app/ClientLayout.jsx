// src/app/ClientLayout.jsx
'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { WsProvider } from '@/contexts/WsContext';
import { DmProvider } from '@/contexts/DmContext';
import { DmCallProvider } from '@/contexts/DmCallContext';
import { WhisperProvider } from '@/contexts/WhisperContext';
import { GroupsProvider } from '@/contexts/GroupsContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { ExploreProvider } from '@/contexts/ExploreContext';
import { LiveProvider } from '@/contexts/LiveContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { PushProvider } from '@/contexts/PushContext';
import { LightboxProvider } from '@/hooks/useLightbox';
import { FeedProvider } from '@/contexts/FeedContext';
import Lightbox from '@/components/ui/Lightbox';
import { useLightbox } from '@/hooks/useLightbox';
import NotificationPanel from '@/components/notification/NotificationPanel';
import IncomingCallModal from '@/components/dm/IncomingCallModal';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SideBar from '@/components/layout/SideBar';
import MobileNavbar from '@/components/layout/MobileNavbar';
import LiveSetupModal from '@/components/live/LiveSetupModal';
import LiveOverlay from '@/components/live/LiveOverlay';
import LiveFeedStrip from '@/components/live/LiveFeedStrip';
import LiveToast from '@/components/live/LiveToast';
import RightSidebar from '@/components/layout/RightSidebar';
import { useScrollDirection } from '@/hooks/useScrollDirection';

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
  const router = useRouter();
  return (
    <button
      onClick={() => router.push('/compose')}
      className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent-glow)] hover:bg-[var(--color-accent-h)] transition-all transform hover:scale-105 md:hidden"
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
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  const { direction, isAtTop } = useScrollDirection();
  const shouldHide = direction === 'down' && !isAtTop;

  const isLanding = pathname === '/';
  const isAdminRoute = pathname?.startsWith('/admin');

  // Route exclusions
  const hideFooterRoutes = [
    '/messages',
    '/live',
    '/compose',
    '/login',
    '/register',
    '/reset-password',
    '/whisper/inbox',
    '/drafts',
    '/feed'
  ];
  
  const hideStripRoutes = [
    '/messages',
    '/live',
    '/compose',
    '/login',
    '/register',
    '/reset-password',
    '/whisper/inbox',
    '/drafts',
    '/explore',
    '/groups',
    '/articles',
    '/settings',
    '/profile',
    '/search',
    '/post/id'
  ];
  
  const hideMobileNavRoutes = [
    '/messages',
    '/live',
    '/compose',
    '/login',
    '/register',
    '/reset-password',
    '/whisper/inbox',
    '/drafts',
  ];
  
  const hideSidebarRoutes = [
    '/messages',
    '/live',
    '/compose',
    '/login',
    '/register',
    '/reset-password',
    '/whisper/inbox',
    '/profile',
    '/settings',
  ];

  // ── Admin routes - hide everything except the admin content ──
  const hideFooter = isAdminRoute || hideFooterRoutes.includes(pathname);
  const hideStrip = isAdminRoute || isLanding || hideStripRoutes.includes(pathname);
  const hideMobileNav = isAdminRoute || isLanding || hideMobileNavRoutes.includes(pathname);
  const hideSidebar = isAdminRoute || isLanding || hideSidebarRoutes.includes(pathname);
  const hideRightSidebar = isAdminRoute || isLanding;
  const shouldHideHeader = isAdminRoute || isLanding || pathname.startsWith('/messages');

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
            <DmCallProvider>
              <WhisperProvider>
                <GroupsProvider>
                  <SearchProvider>
                    <ExploreProvider>
                      <LiveProvider>
                        <NotificationProvider>
                          <LightboxProvider>
                            <FeedProvider>
                              <LightboxWrapper>
                                <div className="flex min-h-screen">
                                  {/* ── Sidebar ── */}
                                  {!isLanding && !hideSidebar && (
                                    <SideBar isOpen={sidebarOpen} onClose={closeSidebar} />
                                  )}
                                  
                                  <div
                                    className={`flex-1 flex flex-col min-h-screen w-full ${
                                      !isLanding && !hideSidebar ? 'md:ml-[280px]' : ''
                                    } ${isAdminRoute ? 'md:ml-0' : ''}`}
                                  >
                                    {/* ── Fixed Header with scroll-hide ── */}
                                    {!isLanding && !shouldHideHeader && (
                                      <>
                                        <div
                                          className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
                                            shouldHide ? '-translate-y-full' : 'translate-y-0'
                                          }`}
                                        >
                                          <Header onMenuClick={toggleSidebar} hideMenu={isLanding} />
                                        </div>
                                        {/* Spacer to prevent content from hiding under the fixed header */}
                                        <div className="h-14" />
                                      </>
                                    )}

                                    <div className={`flex-1 flex px-2 sm:px-6 py-4 gap-6 justify-center w-full ${isAdminRoute ? 'max-w-full' : ''}`}>
                                      <main
                                        className={`flex-1 max-w-2xl min-w-0 w-full ${
                                          isLanding
                                            ? 'p-0'
                                            : hideFooter
                                            ? 'pb-4'
                                            : 'pb-20 md:pb-4'
                                        } ${isAdminRoute ? 'max-w-full' : ''}`}
                                      >
                                        {!isLanding && !hideStrip && <LiveFeedStrip />}
                                        {children}
                                      </main>
                                      
                                      {/* ── RightSidebar ── */}
                                      {!isLanding && !hideRightSidebar && (
                                        <div className="hidden lg:block w-[320px] flex-shrink-0">
                                          <RightSidebar />
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* ── Footer ── */}
                                    {!isLanding && !hideFooter && <Footer />}
                                  </div>
                                </div>

                                {/* ── Floating Components ── */}
                                {!isLanding && (
                                  <>
                                    <IncomingCallModal />
                                    <NotificationPanel />
                                    <LiveSetupModal />
                                    <LiveOverlay />
                                    <LiveToast />
                                    {!hideMobileNav && (
                                      <>
                                        <MobileNavbar
                                          className={`transition-transform duration-300 ease-in-out ${
                                            shouldHide ? 'translate-y-full' : 'translate-y-0'
                                          }`}
                                        />
                                        <div
                                          className={`fixed bottom-20 right-4 z-30 md:hidden transition-all duration-300 ease-in-out ${
                                            shouldHide
                                              ? 'opacity-0 scale-90 pointer-events-none'
                                              : 'opacity-100 scale-100'
                                          }`}
                                        >
                                          <FloatingComposeButton />
                                        </div>
                                      </>
                                    )}
                                  </>
                                )}
                              </LightboxWrapper>
                            </FeedProvider>
                          </LightboxProvider>
                        </NotificationProvider>
                      </LiveProvider>
                    </ExploreProvider>
                  </SearchProvider>
                </GroupsProvider>
              </WhisperProvider>
            </DmCallProvider>
          </DmProvider>
        </PushProvider>
      </WsProvider>
    </AuthProvider>
  );
}