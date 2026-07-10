// app/editor/EditorClient.jsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PhotoEditor from '@/components/PhotoEditor';

export default function EditorClient() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');

  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!key) {
      setError('No image key provided.');
      return;
    }

    // Notify the parent tab that we're ready
    if (window.opener) {
      window.opener.postMessage({ type: 'editor_ready', key }, '*');
    } else {
      setError('This editor must be opened from the compose page.');
      return;
    }

    // Listen for image data from the parent
    const handleMessage = (event) => {
      if (event.data?.type === 'image_data' && event.data.key === key) {
        const dataUrl = event.data.data;
        if (dataUrl) {
          setImage(dataUrl);
        } else {
          setError('No image data received.');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [key]);

  const handleSave = (editedFile) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (window.opener) {
        window.opener.postMessage({ type: 'edited_image', key, data: dataUrl }, '*');
      }
      window.close();
    };
    reader.readAsDataURL(editedFile);
  };

  const handleCancel = () => {
    window.close();
  };

  if (error) {
    return (
      <div className="p-8 text-center text-[var(--color-rose)]">
        <p>{error}</p>
        <button
          onClick={handleCancel}
          className="mt-4 px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg"
        >
          Close
        </button>
      </div>
    );
  }

  if (!image) {
    return <div className="p-8 text-center text-[var(--color-txt2)]">Loading image…</div>;
  }

  return <PhotoEditor image={image} onSave={handleSave} onCancel={handleCancel} fullscreen />;
}