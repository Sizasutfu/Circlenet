'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Header = dynamic(() => import('./Header'), { ssr: false });

export default function HeaderWrapper() {
  return (
    <Suspense fallback={null}>
      <Header />
    </Suspense>
  );
}
