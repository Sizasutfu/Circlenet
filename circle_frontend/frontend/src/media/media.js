// ─────────────────────────────────────────────────────────────
//  media.js — CircleNet Image & Video module
//  Client-side compression/preview for the post composer
//
//  Depends on globals: pendingImageDataUrl, pendingVideoDataUrl,
//                       pendingVideoCompressed, showToast()
//  (pending* vars are declared in post-detail.js / compose state)
// ─────────────────────────────────────────────────────────────

/* IMAGE & VIDEO */

// ── Client-side image compression ──────────────────────────────
// Resizes to maxW/maxH (never upscales), converts to WebP, returns a File.
// Handles EXIF orientation via CSS image-orientation (supported in all
// modern browsers); no extra library needed.
async function compressImage(
  file,
  { maxW = 1920, maxH = 1080, quality = 0.82 } = {},
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = Math.min(maxW / w, maxH / h, 1); // never upscale
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          const outName = file.name.replace(/\.[^.]+$/, ".webp");
          resolve(new File([blob], outName, { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image load failed"));
    };
    // Let CSS handle EXIF orientation automatically
    img.style.imageOrientation = "from-image";
    img.src = objectUrl;
  });
}

// ── Preview + compress a picked image ───────────────────────────
async function previewImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast("Image must be under 10 MB.");
    event.target.value = "";
    return;
  }
  pendingVideoDataUrl = null;

  // Show original instantly for snappy UX, then swap in compressed version
  const previewEl = document.getElementById("img-preview");
  const wrapEl    = document.getElementById("img-preview-wrap");
  const videoEl   = document.getElementById("video-preview");
  const rawUrl    = URL.createObjectURL(file);
  previewEl.src   = rawUrl;
  previewEl.style.display = "block";
  videoEl.style.display   = "none";
  videoEl.src   = "";
  wrapEl.style.display = "block";

  try {
    const compressed = await compressImage(file);
    pendingImageDataUrl = compressed; // store compressed File for FormData upload
    // Swap preview to the compressed version and free the raw object URL
    const compressedUrl = URL.createObjectURL(compressed);
    previewEl.onload = () => URL.revokeObjectURL(compressedUrl);
    previewEl.src = compressedUrl;
    URL.revokeObjectURL(rawUrl);
  } catch (err) {
    // Compression failed — fall back to raw file silently
    console.warn("[Circle] Image compression failed, using original:", err);
    pendingImageDataUrl = file;
  }
}

// ── Client-side video compression (FFmpeg.wasm) ────────────────
// Loaded lazily from CDN the first time a video is picked.
// onProgress(pct: 0–100) is called as FFmpeg works.
let _ffmpegInstance     = null;
let _ffmpegLoaded       = false;
let _ffmpegUnavailable  = false; // true if CDN failed — skip all future attempts

async function _loadFFmpeg() {
  if (_ffmpegLoaded) return _ffmpegInstance;
  if (_ffmpegUnavailable) throw new Error("FFmpeg unavailable");
  // Dynamically load FFmpeg.wasm from CDN (only when needed)
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
      s.onload  = resolve;
      s.onerror = () => reject(new Error("Failed to load FFmpeg.wasm from CDN"));
      document.head.appendChild(s);
    });
    const { createFFmpeg, fetchFile } = FFmpeg;
    _ffmpegInstance = createFFmpeg({ log: false });
    _ffmpegInstance._fetchFile = fetchFile;
    await _ffmpegInstance.load();
    _ffmpegLoaded = true;
    return _ffmpegInstance;
  } catch (err) {
    _ffmpegUnavailable = true; // don't retry on future picks
    throw err;
  }
}

async function compressVideo(file, onProgress) {
  if (_ffmpegUnavailable) throw new Error("FFmpeg unavailable");
  const ff = await _loadFFmpeg();
  ff.setProgress(({ ratio }) =>
    onProgress?.(Math.min(99, Math.round(ratio * 100))),
  );
  const inName  = "input" + file.name.replace(/[^.a-zA-Z0-9]/g, "");
  const outName = "output.mp4";
  ff.FS("writeFile", inName, await ff._fetchFile(file));
  await ff.run(
    "-i", inName,
    "-vcodec", "libx264",
    "-crf", "26", // 18=best quality, 28=smallest, 26=sweet spot
    "-preset", "fast",
    "-movflags", "+faststart", // metadata at front for instant streaming
    "-acodec", "aac",
    "-vf", "scale='min(1280,iw)':-2", // cap width, preserve aspect
    outName,
  );
  const data = ff.FS("readFile", outName);
  // Clean up FFmpeg virtual FS
  try { ff.FS("unlink", inName);  } catch (_) {}
  try { ff.FS("unlink", outName); } catch (_) {}
  onProgress?.(100);
  return new File([data.buffer], file.name.replace(/\.[^.]+$/, ".mp4"), {
    type: "video/mp4",
  });
}

// ── Preview + compress a picked video ───────────────────────────
async function previewVideo(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) {
    showToast("Video must be under 200 MB.");
    return;
  }
  pendingImageDataUrl = null;

  // Show raw video preview immediately
  const videoEl   = document.getElementById("video-preview");
  const imgEl     = document.getElementById("img-preview");
  const wrapEl    = document.getElementById("img-preview-wrap");
  const overlay   = document.getElementById("video-compress-overlay");
  const fillEl    = document.getElementById("video-compress-fill");
  const labelEl   = document.getElementById("video-compress-label");
  const submitBtn = document.getElementById("post-submit-btn");

  const rawUrl = URL.createObjectURL(file);
  videoEl.src = rawUrl;
  videoEl.style.display = "block";
  imgEl.style.display   = "none";
  imgEl.src = "";
  wrapEl.style.display = "block";

  // Lock Post button and show overlay while compressing
  submitBtn.disabled = true;
  overlay.classList.remove("hidden");
  fillEl.style.width = "0%";
  labelEl.textContent = "Compressing… 0%";

  pendingVideoDataUrl    = file; // fallback: use raw if compression fails
  pendingVideoCompressed = false;

  try {
    const compressed = await compressVideo(file, (pct) => {
      fillEl.style.width = pct + "%";
      labelEl.textContent = pct < 100 ? `Compressing… ${pct}%` : "Done ✓";
    });
    pendingVideoDataUrl    = compressed;
    pendingVideoCompressed = true; // client compression succeeded
    // Swap preview to compressed version
    URL.revokeObjectURL(rawUrl);
    videoEl.src = URL.createObjectURL(compressed);
  } catch (err) {
    console.warn("[Circle] Video compression failed, using original:", err);
    const msg = _ffmpegUnavailable
      ? "Compressor unavailable — uploading original video."
      : "Compression failed — uploading original.";
    showToast(msg);
  } finally {
    overlay.classList.add("hidden");
    fillEl.style.width = "0%";
    submitBtn.disabled = false;
  }
}

// ── Remove pending media from the composer ───────────────────────
function removeMedia() {
  pendingImageDataUrl    = null;
  pendingVideoDataUrl    = null;
  pendingVideoCompressed = false;
  document.getElementById("img-preview").src = "";
  document.getElementById("img-preview").style.display = "block";
  const vp = document.getElementById("video-preview");
  vp.pause();
  vp.src = "";
  vp.style.display = "none";
  document.getElementById("img-preview-wrap").style.display = "none";
  document.getElementById("img-input").value   = "";
  document.getElementById("video-input").value = "";
}

function removeImage() {
  removeMedia();
}