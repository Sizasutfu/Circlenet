// src/components/dm/DmMediaUpload.jsx
'use client';

import { useState, useRef } from 'react';
import { apiClient } from '@/lib/api';

export default function DmMediaUpload({ onMediaSelected, disabled }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (200MB)
    if (file.size > 200 * 1024 * 1024) {
      alert('File too large (max 200MB)');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('File type not supported. Please upload an image, video, or audio file.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('media', file);

      const response = await apiClient('/api/dm/upload', {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      if (!response || !response.data) {
        throw new Error('Upload failed');
      }

      // Pass the full media object from the server
      onMediaSelected(response.data);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
        id="dm-media-upload"
      />
      <label
        htmlFor="dm-media-upload"
        className={`flex items-center justify-center w-11 h-11 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-accent-bg)] transition ${
          disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title="Attach image, video, or audio (max 200MB)"
      >
        {isUploading ? (
          <div className="relative w-5 h-5">
            <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-[var(--color-accent)]">
                {uploadProgress}%
              </div>
            )}
          </div>
        ) : (
          <svg className="w-5 h-5 text-[var(--color-txt2)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 4v16M4 12h16" />
          </svg>
        )}
      </label>
    </div>
  );
}