// ============================================================
//  middleware/compress.js
//
//  Development  → compresses images (Sharp → .webp) and
//                 videos (FFmpeg → .mp4), saves to /uploads.
//                 req.compressedFiles = { image?, video? }
//
//  Production   → Cloudinary already handled the upload in
//                 upload.js, so compressUploads is a no-op
//                 passthrough. Sharp/FFmpeg are never loaded.
//
//  Install dependencies (dev only — optional in prod):
//    npm install sharp fluent-ffmpeg ffmpeg-static
// ============================================================

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Production: skip everything, Cloudinary handled it ────
if (IS_PROD) {
  async function compressUploads(req, _res, next) {
    // req.files buffers are already on Cloudinary via upload.js.
    // Normalise req.compressedFiles to mirror the dev shape so
    // route handlers can read from one place regardless of env.
    req.compressedFiles = {};

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (imageFile?.cloudinary) {
      req.compressedFiles.image = {
        secure_url:    imageFile.cloudinary.secure_url,
        public_id:     imageFile.cloudinary.public_id,
        resource_type: imageFile.cloudinary.resource_type,
        savedBytes:    null, // not applicable — Cloudinary manages storage
      };
    }

    if (videoFile?.cloudinary) {
      req.compressedFiles.video = {
        secure_url:    videoFile.cloudinary.secure_url,
        public_id:     videoFile.cloudinary.public_id,
        resource_type: videoFile.cloudinary.resource_type,
        savedBytes:    null,
      };
    }

    next();
  }

  module.exports = { compressUploads };
  return; // nothing below runs in prod
}

// ── Development: full Sharp + FFmpeg pipeline ─────────────
const sharp    = require('sharp');
const ffmpeg   = require('fluent-ffmpeg');
const ffmpegP  = require('ffmpeg-static');     // auto-bundled binary
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const os       = require('os');

ffmpeg.setFfmpegPath(ffmpegP);

// ── Where to save final compressed files ──────────────────
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Where to write temp video files before compression ────
const TMP_DIR = os.tmpdir();

// ─────────────────────────────────────────────────────────
//  Image compression
//  Input  : Buffer (from multer memoryStorage)
//  Output : .webp file saved to UPLOAD_DIR
//  Result : { filename, savedBytes }
// ─────────────────────────────────────────────────────────
async function compressImage(buffer, mimetype = '') {
  const filename   = crypto.randomBytes(16).toString('hex') + '.webp';
  const outputPath = path.join(UPLOAD_DIR, filename);

  if (mimetype === 'image/webp') {
    // Frontend already compressed — save directly, skip Sharp entirely
    fs.writeFileSync(outputPath, buffer);
    console.log('[compress] image skipped (already webp from client)');
    return { filename, savedBytes: 0 };
  }

  await sharp(buffer)
    .rotate()                                    // auto-rotate from EXIF
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })                       // near-lossless, ~30% smaller than JPEG
    .toFile(outputPath);

  const { size } = fs.statSync(outputPath);
  return { filename, savedBytes: buffer.length - size };
}

// ─────────────────────────────────────────────────────────
//  Video compression
//  Input  : Buffer (from multer memoryStorage)
//  Output : .mp4 file saved to UPLOAD_DIR
//  Result : { filename, savedBytes }
// ─────────────────────────────────────────────────────────
function compressVideo(buffer, clientCompressed = false) {
  return new Promise((resolve, reject) => {
    const filename   = crypto.randomBytes(16).toString('hex') + '.mp4';
    const outputPath = path.join(UPLOAD_DIR, filename);

    if (clientCompressed) {
      // Frontend already compressed — save directly, skip FFmpeg entirely
      fs.writeFileSync(outputPath, buffer);
      console.log('[compress] video skipped (already compressed by client)');
      return resolve({ filename, savedBytes: 0 });
    }

    // Write buffer to a temp file — FFmpeg needs a file path
    const tmpName = crypto.randomBytes(16).toString('hex') + '.tmp';
    const tmpPath = path.join(TMP_DIR, tmpName);
    fs.writeFileSync(tmpPath, buffer);

    ffmpeg(tmpPath)
      .videoCodec('libx264')           // H.264 — widest device support
      .audioCodec('aac')
      .addOption('-crf', '26')         // quality 0–51: 18=best, 28=smallest, 26=sweet spot
      .addOption('-preset', 'fast')    // encoding speed vs compression tradeoff
      .addOption('-movflags', '+faststart') // moves metadata to front for streaming
      .size('1280x?')                  // cap width, preserve aspect ratio
      .output(outputPath)
      .on('end', () => {
        fs.unlinkSync(tmpPath);        // clean up temp file
        const { size } = fs.statSync(outputPath);
        resolve({ filename, savedBytes: buffer.length - size });
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        reject(err);
      })
      .run();
  });
}

// ─────────────────────────────────────────────────────────
//  Express middleware
//  Attach this after upload.fields([...]) in your route.
//  Adds req.compressedFiles = { image?, video? } with
//  { filename, savedBytes } for each file.
// ─────────────────────────────────────────────────────────
async function compressUploads(req, _res, next) {
  try {
    req.compressedFiles = {};

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];

    if (imageFile) {
      const result = await compressImage(imageFile.buffer, imageFile.mimetype);
      req.compressedFiles.image = result;
      console.log(
        `[compress] image saved — reduced by ${(result.savedBytes / 1024).toFixed(0)} KB`
      );
    }

    if (videoFile) {
      const clientCompressed = req.body?.video_compressed === '1';
      const result = await compressVideo(videoFile.buffer, clientCompressed);
      req.compressedFiles.video = result;
      console.log(
        `[compress] video saved — reduced by ${(result.savedBytes / 1024 / 1024).toFixed(1)} MB`
      );
    }

    next();
  } catch (err) {
    console.error('[compress] error:', err.message);
    next(err);
  }
}

module.exports = { compressUploads, compressImage, compressVideo };