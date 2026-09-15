// ============================================================
//  middleware/compress.js
//
//  Development  → compresses images (Sharp → .webp) and
//                 videos (FFmpeg → .mp4), saves to /uploads.
//                 req.compressedFiles = { <fieldName>: {...} }
//
//  Production   → Cloudinary already handled the upload in
//                 upload.js, so compressUploads is a no-op
//                 passthrough. Sharp/FFmpeg are never loaded.
//
//  Install dependencies (dev only — optional in prod):
//    npm install sharp fluent-ffmpeg ffmpeg-static
// ============================================================

const IS_PROD = process.env.NODE_ENV === 'production';

// ── Normalise req.files into a { fieldName: File } map ────
// Handles the three shapes multer can produce:
//   upload.fields([...])  → { fieldName: [File] }
//   upload.array(...)     → [File]
//   upload.single(...)    → File
function flattenFiles(req) {
  const out = {};
  const raw = req.files;
  if (!raw) return out;

  if (Array.isArray(raw)) {
    raw.forEach((file, i) => {
      if (file) out[file.fieldname || `file_${i}`] = file;
    });
    return out;
  }

  Object.entries(raw).forEach(([name, val]) => {
    const file = Array.isArray(val) ? val[0] : val;
    if (file) out[name] = file;
  });
  return out;
}

// ════════════════════════════════════════════════════════════
//  Production — skip compression, just mirror Cloudinary data
// ════════════════════════════════════════════════════════════
if (IS_PROD) {
  async function compressUploads(req, _res, next) {
    req.compressedFiles = {};

    const files = flattenFiles(req);

    for (const [fieldName, file] of Object.entries(files)) {
      if (file.cloudinary) {
        req.compressedFiles[fieldName] = {
          secure_url:    file.cloudinary.secure_url,
          public_id:     file.cloudinary.public_id,
          resource_type: file.cloudinary.resource_type,
          savedBytes:    null,
        };
      }
    }

    next();
  }

  module.exports = { compressUploads };
  return;
}

// ════════════════════════════════════════════════════════════
//  Development — full Sharp + FFmpeg pipeline
// ════════════════════════════════════════════════════════════
const sharp    = require('sharp');
const ffmpeg   = require('fluent-ffmpeg');
const ffmpegP  = require('ffmpeg-static');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const os       = require('os');

ffmpeg.setFfmpegPath(ffmpegP);

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TMP_DIR = os.tmpdir();

// ─────────────────────────────────────────────────────────
//  Image compression
// ─────────────────────────────────────────────────────────
async function compressImage(buffer, mimetype = '') {
  const filename   = crypto.randomBytes(16).toString('hex') + '.webp';
  const outputPath = path.join(UPLOAD_DIR, filename);

  if (mimetype === 'image/webp') {
    fs.writeFileSync(outputPath, buffer);
    console.log('[compress] image skipped (already webp from client)');
    return { filename, savedBytes: 0 };
  }

  await sharp(buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outputPath);

  const { size } = fs.statSync(outputPath);
  return { filename, savedBytes: buffer.length - size };
}

// ─────────────────────────────────────────────────────────
//  Video compression
// ─────────────────────────────────────────────────────────
function compressVideo(buffer, clientCompressed = false) {
  return new Promise((resolve, reject) => {
    const filename   = crypto.randomBytes(16).toString('hex') + '.mp4';
    const outputPath = path.join(UPLOAD_DIR, filename);

    if (clientCompressed) {
      fs.writeFileSync(outputPath, buffer);
      console.log('[compress] video skipped (already compressed by client)');
      return resolve({ filename, savedBytes: 0 });
    }

    const tmpName = crypto.randomBytes(16).toString('hex') + '.tmp';
    const tmpPath = path.join(TMP_DIR, tmpName);
    fs.writeFileSync(tmpPath, buffer);

    ffmpeg(tmpPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .addOption('-crf', '26')
      .addOption('-preset', 'fast')
      .addOption('-movflags', '+faststart')
      .size('1280x?')
      .output(outputPath)
      .on('end', () => {
        fs.unlinkSync(tmpPath);
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
//  Express middleware — iterates over every uploaded field
// ─────────────────────────────────────────────────────────
async function compressUploads(req, _res, next) {
  try {
    req.compressedFiles = {};

    const files = flattenFiles(req);
    const fieldNames = Object.keys(files);

    if (fieldNames.length === 0) {
      console.log('[compress] no files to process');
      return next();
    }

    console.log('[compress] processing fields:', fieldNames);

    // Decide which handler to use per field based on mimetype
    await Promise.all(
      fieldNames.map(async (fieldName) => {
        const file = files[fieldName];
        if (!file?.buffer) {
          console.warn(`[compress] no buffer for ${fieldName}, skipping`);
          return;
        }

        try {
          const isVideo =
            file.mimetype?.startsWith('video/') ||
            fieldName.toLowerCase().includes('video');

          if (isVideo) {
            const clientCompressed = req.body?.video_compressed === '1';
            const result = await compressVideo(file.buffer, clientCompressed);
            req.compressedFiles[fieldName] = result;
            console.log(
              `[compress] ${fieldName} (video) saved — reduced by ${(result.savedBytes / 1024 / 1024).toFixed(1)} MB`
            );
          } else {
            const result = await compressImage(file.buffer, file.mimetype);
            req.compressedFiles[fieldName] = result;
            console.log(
              `[compress] ${fieldName} (image) saved — reduced by ${(result.savedBytes / 1024).toFixed(0)} KB → ${result.filename}`
            );
          }
        } catch (err) {
          console.error(`[compress] failed to process ${fieldName}:`, err.message);
          // Don't throw — leave that field unprocessed so the rest can succeed
        }
      })
    );

    console.log('[compress] compressedFiles keys:', Object.keys(req.compressedFiles));
    next();
  } catch (err) {
    console.error('[compress] error:', err.message);
    next(err);
  }
}

module.exports = { compressUploads, compressImage, compressVideo };