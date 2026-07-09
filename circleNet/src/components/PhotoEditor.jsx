// src/components/PhotoEditor.jsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';

export default function PhotoEditor({ image, onSave, onCancel, fullscreen = false }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVideo, setIsVideo] = useState(false);

  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // ── Detect if the input is a video ──
  useEffect(() => {
    const isVideoUrl = (url) => {
      return /\.(mp4|webm|mov|avi|mkv|m4v|ogv)$/i.test(url) ||
        url.startsWith('data:video/') ||
        (typeof url === 'string' && url.includes('video'));
    };
    if (isVideoUrl(image)) {
      setIsVideo(true);
    } else {
      setIsVideo(false);
    }
  }, [image]);

  // ── Load image ──
  useEffect(() => {
    if (isVideo) {
      // Video will be loaded via the video element
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      applyFilters(img, brightness, contrast, saturation, rotation);
    };
    img.src = image;
  }, [image, isVideo]);

  // ── Apply filters to canvas (images only) ──
  const applyFilters = useCallback((img, b, c, s, rot) => {
    if (isVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rad = (rot || 0) * Math.PI / 180;
    const w = img.width;
    const h = img.height;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const newW = Math.floor(w * cos + h * sin);
    const newH = Math.floor(w * sin + h * cos);

    canvas.width = newW;
    canvas.height = newH;
    ctx.clearRect(0, 0, newW, newH);
    ctx.translate(newW/2, newH/2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w/2, -h/2, w, h);

    const imageData = ctx.getImageData(0, 0, newW, newH);
    const data = imageData.data;
    const bVal = (b || 0) / 100;
    const cVal = (c || 0) / 100;
    const sVal = (s || 0) / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i+1];
      let bl = data[i+2];

      const factor = (259 * (cVal * 255 + 255)) / (255 * (259 - cVal * 255));
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      bl = factor * (bl - 128) + 128;

      r += bVal * 255;
      g += bVal * 255;
      bl += bVal * 255;

      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * bl;
      r = gray + (sVal * (r - gray));
      g = gray + (sVal * (g - gray));
      bl = gray + (sVal * (bl - gray));

      data[i] = Math.min(255, Math.max(0, r));
      data[i+1] = Math.min(255, Math.max(0, g));
      data[i+2] = Math.min(255, Math.max(0, bl));
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }, [isVideo]);

  // ── Update preview when sliders change (images) ──
  useEffect(() => {
    if (isVideo) return;
    if (!imageRef.current) return;
    const img = imageRef.current;
    applyFilters(img, brightness, contrast, saturation, rotation);
  }, [brightness, contrast, saturation, rotation, applyFilters, isVideo]);

  // ── For videos: apply CSS filters and rotation ──
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    const video = videoRef.current;
    const bVal = brightness / 100;
    const cVal = contrast / 100;
    const sVal = saturation / 100;
    // Use CSS filters for preview
    video.style.filter = `brightness(${1 + bVal}) contrast(${1 + cVal}) saturate(${1 + sVal})`;
    video.style.transform = `rotate(${rotation}deg)`;
  }, [brightness, contrast, saturation, rotation, isVideo]);

  // ── Save edited image/video ──
  const handleSave = async () => {
    setIsProcessing(true);
    try {
      if (isVideo) {
        // ── Video saving ──
        const video = videoRef.current;
        if (!video) throw new Error('Video not loaded');
        // Seek to start to capture
        video.currentTime = 0;
        await new Promise(resolve => video.onseeked = resolve);

        // Create canvas with crop and rotation applied
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const videoWidth = video.videoWidth || 1280;
        const videoHeight = video.videoHeight || 720;

        // Calculate crop
        const scaleX = videoWidth / 100;
        const scaleY = videoHeight / 100;
        const cropWidth = crop.width * scaleX;
        const cropHeight = crop.height * scaleY;
        const cropX = crop.x * scaleX;
        const cropY = crop.y * scaleY;

        // Apply rotation
        const rad = rotation * Math.PI / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const outW = Math.floor(cropWidth * cos + cropHeight * sin);
        const outH = Math.floor(cropWidth * sin + cropHeight * cos);

        canvas.width = outW;
        canvas.height = outH;
        ctx.clearRect(0, 0, outW, outH);
        ctx.translate(outW/2, outH/2);
        ctx.rotate(rad);
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, -cropWidth/2, -cropHeight/2, cropWidth, cropHeight);

        // Apply filters to canvas (pixel-level)
        const imageData = ctx.getImageData(0, 0, outW, outH);
        const data = imageData.data;
        const bVal = brightness / 100;
        const cVal = contrast / 100;
        const sVal = saturation / 100;
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i+1];
          let bl = data[i+2];
          const factor = (259 * (cVal * 255 + 255)) / (255 * (259 - cVal * 255));
          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          bl = factor * (bl - 128) + 128;
          r += bVal * 255;
          g += bVal * 255;
          bl += bVal * 255;
          const gray = 0.2989 * r + 0.5870 * g + 0.1140 * bl;
          r = gray + (sVal * (r - gray));
          g = gray + (sVal * (g - gray));
          bl = gray + (sVal * (bl - gray));
          data[i] = Math.min(255, Math.max(0, r));
          data[i+1] = Math.min(255, Math.max(0, g));
          data[i+2] = Math.min(255, Math.max(0, bl));
        }
        ctx.putImageData(imageData, 0, 0);

        // Export as video using MediaRecorder (silent)
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const file = new File([blob], 'edited-video.webm', { type: 'video/webm' });
          onSave(file);
        };
        mediaRecorder.start();
        // Stop after capturing a few frames (or we could loop through video duration)
        // For simplicity, we capture 1 second worth of frames (30 frames)
        setTimeout(() => {
          mediaRecorder.stop();
        }, 1500);
        // Wait for recording to finish
        await new Promise(resolve => mediaRecorder.onstop = resolve);
      } else {
        // ── Image saving ──
        let croppedUrl = image;
        const isCropDefault = crop.x === 0 && crop.y === 0 && zoom === 1;
        if (!isCropDefault) {
          croppedUrl = await getCroppedImg(image, crop, zoom);
        }

        const img = new Image();
        img.src = croppedUrl;
        await new Promise(resolve => img.onload = resolve);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const rad = rotation * Math.PI / 180;
        const w = img.width;
        const h = img.height;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const newW = Math.floor(w * cos + h * sin);
        const newH = Math.floor(w * sin + h * cos);
        canvas.width = newW;
        canvas.height = newH;
        ctx.clearRect(0, 0, newW, newH);
        ctx.translate(newW/2, newH/2);
        ctx.rotate(rad);
        ctx.drawImage(img, -w/2, -h/2, w, h);

        const imageData = ctx.getImageData(0, 0, newW, newH);
        const data = imageData.data;
        const bVal = brightness / 100;
        const cVal = contrast / 100;
        const sVal = saturation / 100;
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i+1];
          let bl = data[i+2];
          const factor = (259 * (cVal * 255 + 255)) / (255 * (259 - cVal * 255));
          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          bl = factor * (bl - 128) + 128;
          r += bVal * 255;
          g += bVal * 255;
          bl += bVal * 255;
          const gray = 0.2989 * r + 0.5870 * g + 0.1140 * bl;
          r = gray + (sVal * (r - gray));
          g = gray + (sVal * (g - gray));
          bl = gray + (sVal * (bl - gray));
          data[i] = Math.min(255, Math.max(0, r));
          data[i+1] = Math.min(255, Math.max(0, g));
          data[i+2] = Math.min(255, Math.max(0, bl));
        }
        ctx.putImageData(imageData, 0, 0);

        const finalBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([finalBlob], 'edited-image.png', { type: 'image/png' });
        onSave(file);
      }
    } catch (err) {
      console.error('Save error:', err);
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    if (imageRef.current || videoRef.current) setImgLoaded(true);
  }, [image]);

  // ── Fullscreen wrapper classes ──
  const rootClasses = fullscreen
    ? 'fixed inset-0 z-50 bg-[var(--color-bg)] flex items-center justify-center'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4';

  const containerClasses = fullscreen
    ? 'w-full h-full bg-[var(--color-card)] flex flex-col'
    : 'bg-[var(--color-card)] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col';

  const contentClasses = fullscreen
    ? 'flex-1 overflow-hidden flex flex-col md:flex-row min-h-0'
    : 'flex-1 overflow-hidden flex flex-col md:flex-row';

  const previewClasses = fullscreen
    ? 'flex-1 p-4 bg-black/10 flex items-center justify-center relative min-h-[200px] md:min-h-0'
    : 'flex-1 p-4 bg-black/10 flex items-center justify-center relative min-h-[200px]';

  const controlsClasses = fullscreen
    ? 'w-full md:w-80 p-4 border-t md:border-t-0 md:border-l border-[var(--color-border)] overflow-y-auto space-y-4'
    : 'w-full md:w-64 p-4 border-t md:border-t-0 md:border-l border-[var(--color-border)] overflow-y-auto space-y-4';

  const cropperContainerClasses = fullscreen
    ? 'relative h-48 md:h-64 bg-black/20 rounded-lg overflow-hidden'
    : 'relative h-32 bg-black/20 rounded-lg overflow-hidden';

  return (
    <div className={rootClasses}>
      <div className={containerClasses}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="font-head font-bold text-[var(--color-txt)]">
            {isVideo ? 'Video Editor' : 'Photo Editor'}
          </h3>
          <button onClick={onCancel} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">×</button>
        </div>

        <div className={contentClasses}>
          {/* Preview area */}
          <div className={previewClasses} ref={containerRef}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={image}
                controls
                className="max-w-full max-h-[50vh] md:max-h-[70vh] object-contain rounded-lg"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  filter: `brightness(${1 + brightness/100}) contrast(${1 + contrast/100}) saturate(${1 + saturation/100})`,
                }}
              />
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[50vh] md:max-h-[70vh] object-contain rounded-lg"
                style={{ background: '#1a1a1a' }}
              />
            )}
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-txt3)]">
                Loading…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className={controlsClasses}>
            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Crop (drag to adjust)</label>
              <div className={cropperContainerClasses}>
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={isVideo ? 16/9 : 4/3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="mt-1">
                <label className="text-xs text-[var(--color-txt2)]">Zoom</label>
                <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Rotation</label>
              <div className="flex gap-2">
                <button onClick={() => setRotation((r) => (r + 90) % 360)} className="px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm hover:bg-[var(--color-accent-bg)] transition">
                  ↻ 90°
                </button>
                <button onClick={() => setRotation(0)} className="px-3 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-sm hover:bg-[var(--color-accent-bg)] transition">
                  Reset
                </button>
              </div>
              <input type="range" min="0" max="360" step="1" value={rotation} onChange={(e) => setRotation(parseFloat(e.target.value))} className="w-full mt-1" />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Brightness</label>
              <input type="range" min="-100" max="100" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Contrast</label>
              <input type="range" min="-100" max="100" value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Saturation</label>
              <input type="range" min="-100" max="100" value={saturation} onChange={(e) => setSaturation(parseFloat(e.target.value))} className="w-full" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-[var(--color-txt2)] hover:bg-[var(--color-surface)] rounded-lg transition">Cancel</button>
          <button onClick={handleSave} disabled={isProcessing} className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50">
            {isProcessing ? 'Saving…' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}