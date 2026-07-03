// src/components/PhotoEditor.jsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';

export default function PhotoEditor({ image, onSave, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  // ── Apply filters to canvas ──
  const applyFilters = useCallback((img, b, c, s, rot) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Handle rotation
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

    // Apply filters
    const imageData = ctx.getImageData(0, 0, newW, newH);
    const data = imageData.data;
    const bVal = (b || 0) / 100;
    const cVal = (c || 0) / 100;
    const sVal = (s || 0) / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i+1];
      let bl = data[i+2];

      // Contrast
      const factor = (259 * (cVal * 255 + 255)) / (255 * (259 - cVal * 255));
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      bl = factor * (bl - 128) + 128;

      // Brightness
      r += bVal * 255;
      g += bVal * 255;
      bl += bVal * 255;

      // Saturation
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
  }, []);

  // ── Update preview when sliders change ──
  useEffect(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;
    applyFilters(img, brightness, contrast, saturation, rotation);
  }, [brightness, contrast, saturation, rotation, applyFilters]);

  // ── Load image ──
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      applyFilters(img, brightness, contrast, saturation, rotation);
    };
    img.src = image;
  }, [image]);

  // ── Save edited image ──
  const handleSave = async () => {
    setIsProcessing(true);
    try {
      // 1. Crop if needed (only if crop is not default)
      let croppedUrl = image;
      const isCropDefault = crop.x === 0 && crop.y === 0 && zoom === 1;
      if (!isCropDefault) {
        croppedUrl = await getCroppedImg(image, crop, zoom);
      }

      // 2. Load cropped image and apply filters
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

      // Apply filters
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
    } catch (err) {
      console.error('Save error:', err);
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    if (imageRef.current) setImgLoaded(true);
  }, [image]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[var(--color-card)] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="font-head font-bold text-[var(--color-txt)]">Photo Editor</h3>
          <button onClick={onCancel} className="text-[var(--color-txt2)] hover:text-[var(--color-txt)] text-xl">×</button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Preview area */}
          <div className="flex-1 p-4 bg-black/10 flex items-center justify-center relative min-h-[200px]">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[50vh] object-contain rounded-lg"
              style={{ background: '#1a1a1a' }}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-txt3)]">
                Loading image…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="w-full md:w-64 p-4 border-t md:border-t-0 md:border-l border-[var(--color-border)] overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-txt2)] block mb-1">Crop (drag to adjust)</label>
              <div className="relative h-32 bg-black/20 rounded-lg overflow-hidden">
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={4/3}
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