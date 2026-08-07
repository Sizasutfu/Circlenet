// src/app/edit-post/[id]/page.js
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/url';
import AvatarPlaceholder from '@/components/ui/AvatarPlaceholder';

export default function EditPostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const postId = params.id;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [post, setPost] = useState(null);
  
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [deleteImage, setDeleteImage] = useState(false);
  const [deleteVideo, setDeleteVideo] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Fetch post data
  useEffect(() => {
    if (!postId || !user) return;

    const fetchPost = async () => {
      try {
        const response = await apiClient(`/api/posts/${postId}`);
        const postData = response.data || response;
        
        if (postData.user?.id !== user.id && postData.authorId !== user.id) {
          setError('You do not have permission to edit this post.');
          setLoading(false);
          return;
        }

        setPost(postData);
        setText(postData.text || '');
        
        if (postData.image) {
          setImagePreview(resolveMediaUrl(postData.image));
        }
        if (postData.video) {
          setVideoPreview(resolveMediaUrl(postData.video));
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load post.');
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId, user]);

  // Image handlers
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setError('Image must be under 30MB.');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setDeleteImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setError('Video must be under 200MB.');
      return;
    }
    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
    setDeleteVideo(false);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeImage = () => {
    if (imagePreview && !imagePreview.startsWith('http')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImage(null);
    setImagePreview(null);
    setDeleteImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeVideo = () => {
    if (videoPreview && !videoPreview.startsWith('http')) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideo(null);
    setVideoPreview(null);
    setDeleteVideo(true);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Submit - using FormData with proper headers
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!text.trim() && !image && !video && !imagePreview && !videoPreview) {
      setError('Please write something or add media.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Get auth token
      const token = localStorage.getItem('circle_token') || 
                   JSON.parse(localStorage.getItem('circle_user') || '{}')?.token;
      const userId = JSON.parse(localStorage.getItem('circle_user') || '{}')?.id;

      if (!token || !userId) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('text', text.trim());
      
      if (image) formData.append('image', image);
      if (video) formData.append('video', video);
      
      if (deleteImage) formData.append('deleteImage', 'true');
      if (deleteVideo) formData.append('deleteVideo', 'true');

      // Direct fetch with proper headers
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || ''}/api/posts/${postId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-User-Id': String(userId),
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update post');
      }

      const result = await response.json();
      
      // Navigate to the post page
      router.push(`/post/${postId}`);
      router.refresh();
    } catch (err) {
      console.error('Edit error:', err);
      setError(err.message || 'Failed to update post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-accent)] border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-[var(--color-rose-bg)] border border-[var(--color-rose)] rounded-xl p-4 text-[var(--color-rose)]">
          {error}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-[var(--color-txt2)] hover:text-[var(--color-txt)] rounded-lg hover:bg-[var(--color-surface)] transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">
          Edit Post
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          {user?.picture ? (
            <img
              src={resolveMediaUrl(user.picture)}
              alt={user.name}
              className="flex-shrink-0 h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <AvatarPlaceholder size="h-10 w-10" />
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--color-txt)]">{user?.name}</p>
            <p className="text-xs text-[var(--color-txt2)]">Editing your post</p>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] outline-none resize-none min-h-[120px]"
          rows={4}
        />

        {/* Existing Image */}
        {imagePreview && !deleteImage && (
          <div className="space-y-2">
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Current image"
                className="max-h-48 rounded-lg border border-[var(--color-border)]"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[var(--color-txt3)]">Current image</p>
          </div>
        )}

        {/* Existing Video */}
        {videoPreview && !deleteVideo && (
          <div className="space-y-2">
            <div className="relative inline-block">
              <video
                src={videoPreview}
                controls
                className="max-h-48 rounded-lg border border-[var(--color-border)]"
              />
              <button
                type="button"
                onClick={removeVideo}
                className="absolute -top-2 -right-2 bg-[var(--color-rose)] text-white rounded-full p-1 hover:bg-[var(--color-rose)]/80 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-[var(--color-txt3)]">Current video</p>
          </div>
        )}

        {/* Media upload buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition text-sm flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            {imagePreview && !deleteImage ? 'Change Image' : 'Add Image'}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageSelect}
            />
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="text-[var(--color-txt2)] hover:text-[var(--color-accent)] transition text-sm flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            {videoPreview && !deleteVideo ? 'Change Video' : 'Add Video'}
            <input
              type="file"
              ref={videoInputRef}
              className="hidden"
              accept="video/*"
              onChange={handleVideoSelect}
            />
          </button>
        </div>

        {error && (
          <div className="text-sm text-[var(--color-rose)] bg-[var(--color-rose-bg)] p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full text-sm font-medium hover:bg-[var(--color-surface)] transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}