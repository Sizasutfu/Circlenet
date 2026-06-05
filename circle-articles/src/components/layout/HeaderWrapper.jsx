'use client';

import { Suspense } from 'react';
import Header from './Header';

export default function HeaderWrapper() {
  return (
    <Suspense fallback={null}>
      <Header />
    </Suspense>
  );
}
