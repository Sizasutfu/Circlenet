// ============================================================
//  middleware/uploadAudio.js
//
//  Multer for track uploads. Memory storage → file.buffer.
//  The controller writes the buffer to a temp file, compresses
//  it into MUSIC_DIR, and stores only the compressed filename.
// ============================================================

const multer = require('multer');
const path   = require('path');

const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 MB

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const okMime = file.mimetype?.startsWith('audio/');
  const okExt  = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(file.originalname || '');
  if (okMime || okExt) return cb(null, true);
  cb(new Error('Only audio files are allowed.'));
}

const uploadAudio = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_AUDIO_SIZE, files: 1 },
}).single('audio');

// src/middleware → .. → src → .. → circle_backend → storage/music
const MUSIC_DIR = path.join(__dirname, '..', '..', 'storage', 'music');

module.exports = { uploadAudio, MUSIC_DIR };