// ============================================================
//  middleware/uploadAudio.js
//
//  Audio-only upload, written straight to disk (NOT memory, so a
//  50 MB song never sits in RAM). Files go to <project>/storage/music.
//
//  Some clients (curl, some mobile pickers) send audio as
//  application/octet-stream. In that case we trust the file
//  extension instead, and normalise req.file.mimetype so the rest
//  of the app (DB row, streaming Content-Type) sees a real audio type.
//
//  Production later: swap this for multer memory storage + an
//  S3 / Cloudflare R2 upload. Nothing else needs to know, because
//  the DB only stores file_name.
// ============================================================

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { sendError } = require('./response');

const MUSIC_DIR = path.join(__dirname, '..', '..', 'storage', 'music');
fs.mkdirSync(MUSIC_DIR, { recursive: true });

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 MB

// Accepted MIME types → the extension we store them under
const MIME_TO_EXT = {
  'audio/mpeg':  '.mp3',
  'audio/mp3':   '.mp3',
  'audio/mp4':   '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac':   '.aac',
  'audio/wav':   '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg':   '.ogg',
  'audio/flac':  '.flac',
  'audio/x-flac':'.flac',
  'audio/webm':  '.webm',
};

// Fallback when the client doesn't send a useful MIME type
const EXT_TO_MIME = {
  '.mp3':  'audio/mpeg',
  '.m4a':  'audio/mp4',
  '.aac':  'audio/aac',
  '.wav':  'audio/wav',
  '.ogg':  'audio/ogg',
  '.oga':  'audio/ogg',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
};

const GENERIC_MIMES = ['application/octet-stream', 'binary/octet-stream', ''];

function extOf(file) {
  return path.extname(file.originalname || '').toLowerCase();
}

// Work out the real audio MIME type for an incoming file, or null if unsupported
function resolveAudioMime(file) {
  if (MIME_TO_EXT[file.mimetype]) return file.mimetype;
  if (GENERIC_MIMES.includes(file.mimetype || '')) return EXT_TO_MIME[extOf(file)] || null;
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MUSIC_DIR),
  filename: (_req, file, cb) => {
    const mime = resolveAudioMime(file);
    const ext  = (mime && MIME_TO_EXT[mime]) || '.bin';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (resolveAudioMime(file)) return cb(null, true);
    cb(new Error(
      `File type '${file.mimetype}' (${extOf(file) || 'no extension'}) is not a supported audio format.`
    ));
  },
}).single('audio');

// Wrapper so upload errors come back as clean 400s instead of
// falling through to the generic error handler.
function uploadAudio(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 413, 'Audio file is too large (max 50 MB).');
      }
      return sendError(res, 400, err.message || 'Audio upload failed.');
    }

    // Normalise the MIME type so the DB + streaming see a real audio type
    if (req.file) req.file.mimetype = resolveAudioMime(req.file);

    next();
  });
}

module.exports = uploadAudio;
module.exports.MUSIC_DIR = MUSIC_DIR;