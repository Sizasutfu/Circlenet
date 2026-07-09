// app/editor/page.jsx
import { Suspense } from 'react';
import EditorClient from './EditorClient';

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--color-txt2)]">Loading editor...</div>}>
      <EditorClient />
    </Suspense>
  );
}