// ============================================================
//  middleware/compress.js
//
//  Development  → compresses images (Sharp → .webp), videos
//                 (FFmpeg → .mp4) into /uploads, and audio
//                 (FFmpeg → .m4a) into /storage/music.
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

// src/middleware → .. → src → .. → circle_backend
const ROOT = path.join(__dirname, '..', '..');

// Images + videos — general post media
const UPLOAD_DIR = path.join(ROOT, 'uploads');

// Music tracks — dedicated folder for the music player
const MUSIC_DIR  = path.join(ROOT, 'storage', 'music');

for (const dir of [UPLOAD_DIR, MUSIC_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const TMP_DIR = os.tmpdir();

// ─────────────────────────────────────────────────────────
//  Field-name → media-type detection
// ─────────────────────────────────────────────────────────
function detectKind(file, fieldName = '') {
  const mt   = (file?.mimetype ?? '').toLowerCase();
  const name = fieldName.toLowerCase();

  if (mt.startsWith('video/') || name.includes('video')) return 'video';
  if (
    mt.startsWith('audio/') ||
    name.includes('audio') ||
    name.includes('track') ||
    name.includes('song')
  ) {
    return 'audio';
  }
  return 'image';
}

// ─────────────────────────────────────────────────────────
//  Image compression  →  uploads/<hex>.webp
// ─────────────────────────────────────────────────────────
async function compressImage(buffer, mimetype = '') {
  const filename   = crypto.randomBytes(16).toString('hex') + '.webp';
  const outputPath = path.join(UPLOAD_DIR, filename);

  if (mimetype === 'image/webp') {
    fs.writeFileSync(outputPath, buffer);
    console.log('[compress] image skipped (already webp from client)');
    return {
      filename,
      relativePath: `uploads/${filename}`,
      kind: 'image',
      savedBytes: 0,
    };
  }

  await sharp(buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outputPath);

  const { size } = fs.statSync(outputPath);
  return {
    filename,
    relativePath: `uploads/${filename}`,
    kind: 'image',
    savedBytes: buffer.length - size,
  };
}

// ─────────────────────────────────────────────────────────
//  Video compression  →  uploads/<hex>.mp4
// ─────────────────────────────────────────────────────────
function compressVideo(buffer, clientCompressed = false) {
  return new Promise((resolve, reject) => {
    const filename   = crypto.randomBytes(16).toString('hex') + '.mp4';
    const outputPath = path.join(UPLOAD_DIR, filename);

    if (clientCompressed) {
      fs.writeFileSync(outputPath, buffer);
      console.log('[compress] video skipped (already compressed by client)');
      return resolve({
        filename,
        relativePath: `uploads/${filename}`,
        kind: 'video',
        savedBytes: 0,
      });
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
        resolve({
          filename,
          relativePath: `uploads/${filename}`,
          kind: 'video',
          savedBytes: buffer.length - size,
        });
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        reject(err);
      })
      .run();
  });
}

// ─────────────────────────────────────────────────────────
//  Audio compression (buffer → storage/music/<hex>.m4a)
// ─────────────────────────────────────────────────────────
function compressAudio(buffer, clientCompressed = false) {
  return new Promise((resolve, reject) => {
    const filename   = crypto.randomBytes(16).toString('hex') + '.m4a';
    const outputPath = path.join(MUSIC_DIR, filename);

    if (clientCompressed) {
      fs.writeFileSync(outputPath, buffer);
      console.log('[compress] audio skipped (already compressed by client)');
      return resolve({
        filename,
        relativePath: `storage/music/${filename}`,
        kind: 'audio',
        savedBytes: 0,
      });
    }

    const tmpName = crypto.randomBytes(16).toString('hex') + '.tmp';
    const tmpPath = path.join(TMP_DIR, tmpName);
    fs.writeFileSync(tmpPath, buffer);

    ffmpeg(tmpPath)
      .audioCodec('aac')
      .audioBitrate('192k')
      .addOption('-vn')
      .addOption('-movflags', '+faststart')
      .format('ipod')
      .output(outputPath)
      .on('end', () => {
        fs.unlinkSync(tmpPath);
        const { size } = fs.statSync(outputPath);
        resolve({
          filename,
          relativePath: `storage/music/${filename}`,
          kind: 'audio',
          savedBytes: buffer.length - size,
        });
      })
      .on('error', (err) => {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        reject(err);
      })
      .run();
  });
}

// ─────────────────────────────────────────────────────────
//  Audio compression (file → storage/music/<hex>.m4a)
//
//  Reads an existing file from disk, writes the compressed
//  output into MUSIC_DIR. Use this when multer is on disk
//  storage OR when the controller has already written the
//  buffer to a temp file.
// ─────────────────────────────────────────────────────────
function compressAudioFile(inputPath, opts = {}) {
  return new Promise((resolve, reject) => {
    const ext        = opts.ext || '.m4a';
    const filename   = crypto.randomBytes(16).toString('hex') + ext;
    const outputPath = path.join(MUSIC_DIR, filename);

    const originalSize = fs.existsSync(inputPath)
      ? fs.statSync(inputPath).size
      : 0;

    ffmpeg(inputPath)
      .audioCodec(opts.codec || 'aac')
      .audioBitrate(opts.bitrate || '192k')
      .addOption('-vn')
      .addOption('-movflags', '+faststart')
      .format(opts.format || 'ipod')
      .output(outputPath)
      .on('end', () => {
        const { size } = fs.statSync(outputPath);
        resolve({
          filename,
          path:          outputPath,
          kind:          'audio',
          originalBytes: originalSize,
          savedBytes:    originalSize - size,
        });
      })
      .on('error', reject)
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

    await Promise.all(
      fieldNames.map(async (fieldName) => {
        const file = files[fieldName];
        if (!file?.buffer) {
          console.warn(`[compress] no buffer for ${fieldName}, skipping`);
          return;
        }

        try {
          const kind = detectKind(file, fieldName);

          if (kind === 'video') {
            const clientCompressed = req.body?.video_compressed === '1';
            const result = await compressVideo(file.buffer, clientCompressed);
            req.compressedFiles[fieldName] = result;
            console.log(
              `[compress] ${fieldName} (video) saved — reduced by ${(result.savedBytes / 1024 / 1024).toFixed(1)} MB → ${result.relativePath}`
            );
          } else if (kind === 'audio') {
            const clientCompressed = req.body?.audio_compressed === '1';
            const result = await compressAudio(file.buffer, clientCompressed);
            req.compressedFiles[fieldName] = result;
            console.log(
              `[compress] ${fieldName} (audio) saved — reduced by ${(result.savedBytes / 1024 / 1024).toFixed(1)} MB → ${result.relativePath}`
            );
          } else {
            const result = await compressImage(file.buffer, file.mimetype);
            req.compressedFiles[fieldName] = result;
            console.log(
              `[compress] ${fieldName} (image) saved — reduced by ${(result.savedBytes / 1024).toFixed(0)} KB → ${result.relativePath}`
            );
          }
        } catch (err) {
          console.error(`[compress] failed to process ${fieldName}:`, err.message);
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

const PATHS = {
  uploads: UPLOAD_DIR,
  music:   MUSIC_DIR,
  root:    ROOT,
};

module.exports = {
  compressUploads,
  compressImage,
  compressVideo,
  compressAudio,
  compressAudioFile,
  detectKind,
  PATHS,
};