// ============================================================
//  controllers/trackController.js
//  Request/response logic for music tracks.
//
//  Multer is on memory storage, so req.file.buffer is the
//  uploaded bytes. We write them to a temp file so ffmpeg and
//  music-metadata can read them, compress into storage/music/,
//  delete the temp, and store only the compressed filename in
//  the DB.
//
//  Streaming uses res.sendFile, which already handles HTTP Range
//  requests (seeking), ETag and 206 Partial Content.
// ============================================================

const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const crypto     = require('crypto');
const TrackModel = require('../models/trackModel');
const { MUSIC_DIR } = require('../middleware/uploadAudio');
const { compressAudioFile } = require('../middleware/compress');
const { sendOk, sendError } = require('../middleware/response');

// ── Shape a DB row for the client ───────────────────────────
function shapeTrack(row, req) {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return {
    id:          row.id,
    userId:      row.user_id,
    title:       row.title,
    artist:      row.artist,
    durationSec: row.duration_sec,
    sizeBytes:   Number(row.size_bytes),
    playCount:   row.play_count,
    createdAt:   row.created_at,
    streamUrl:   `${baseUrl}/api/tracks/${row.id}/stream`,
  };
}

// ── Read title / artist / duration from a file on disk ──────
async function readMetadata(filePath) {
  try {
    const { parseFile } = await import('music-metadata');
    const meta = await parseFile(filePath, { duration: true });
    return {
      title:       meta.common.title  || null,
      artist:      meta.common.artist || null,
      durationSec: meta.format.duration ? Math.round(meta.format.duration) : null,
    };
  } catch (err) {
    console.warn('[tracks] could not read metadata:', err.message);
    return {};
  }
}

function deleteFileQuietly(filePath) {
  fs.unlink(filePath, () => {});
}

// ── POST /api/tracks ────────────────────────────────────────
async function createTrack(req, res) {
  const userId = req.actorId;
  const file   = req.file;

  if (!file || !file.buffer) {
    return sendError(res, 400, 'No audio file uploaded (field name: "audio").');
  }

  // Write the buffer to a temp file so ffmpeg + music-metadata can read it
  const ext     = path.extname(file.originalname || '') || '.audio';
  const tmpName = crypto.randomBytes(16).toString('hex') + ext;
  const tmpPath = path.join(os.tmpdir(), tmpName);
  fs.writeFileSync(tmpPath, file.buffer);

  let finalFileName = null;
  let finalSize     = file.size;
  let finalMime     = file.mimetype;
  let savedBytes    = 0;

  try {
    // 1. Read metadata from the temp file
    const meta = await readMetadata(tmpPath);

    // 2. Compress the temp file into MUSIC_DIR
    try {
      const compressed = await compressAudioFile(tmpPath);
      finalFileName = compressed.filename;
      finalSize     = fs.statSync(compressed.path).size;
      finalMime     = 'audio/mp4';
      savedBytes    = compressed.savedBytes;

      console.log(
        `[tracks] compressed ${file.originalname} → ${finalFileName} ` +
        `(saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB)`
      );
    } catch (compressErr) {
      // Fallback: store the original buffer in MUSIC_DIR with a fresh name
      console.warn(
        '[tracks] compression failed, storing original:',
        compressErr.message
      );
      finalFileName = crypto.randomBytes(16).toString('hex') + ext;
      fs.writeFileSync(path.join(MUSIC_DIR, finalFileName), file.buffer);
      finalSize     = file.size;
      finalMime     = file.mimetype;
      savedBytes    = 0;
    }

    // 3. Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch (_) {}

    // 4. Derive display fields
    const title = (
      req.body.title?.trim() ||
      meta.title ||
      path.parse(file.originalname).name
    ).slice(0, 255);

    const artist = (
      req.body.artist?.trim() ||
      meta.artist ||
      ''
    ).slice(0, 255) || null;

    // 5. Insert DB row
    const id = await TrackModel.create({
      userId,
      title,
      artist,
      fileName:    finalFileName,
      mimeType:    finalMime,
      sizeBytes:   finalSize,
      durationSec: meta.durationSec,
    });

    const row = await TrackModel.getById(id);
    return sendOk(res, 201, 'Track uploaded.', {
      ...shapeTrack(row, req),
      savedBytes,
    });
  } catch (err) {
    console.error('[tracks] createTrack error:', err);

    try { fs.unlinkSync(tmpPath); } catch (_) {}
    if (finalFileName) {
      try { fs.unlinkSync(path.join(MUSIC_DIR, finalFileName)); } catch (_) {}
    }

    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/tracks ─────────────────────────────────────────
async function getTracks(req, res) {
  const userId = req.query.userId ? parseInt(req.query.userId) : null;
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    const { tracks, hasMore } = await TrackModel.list({ userId, page, limit });
    return sendOk(res, 200, 'Tracks fetched.', {
      tracks: tracks.map(t => shapeTrack(t, req)),
      hasMore,
      page,
      limit,
    });
  } catch (err) {
    console.error('[tracks] getTracks error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/tracks/:id ─────────────────────────────────────
async function getTrackById(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid track ID.');

  try {
    const row = await TrackModel.getById(id);
    if (!row) return sendError(res, 404, 'Track not found.');
    return sendOk(res, 200, 'Track fetched.', shapeTrack(row, req));
  } catch (err) {
    console.error('[tracks] getTrackById error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── GET /api/tracks/:id/stream ──────────────────────────────
async function streamTrack(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid track ID.');

  try {
    const row = await TrackModel.getById(id);
    if (!row) return sendError(res, 404, 'Track not found.');

    res.type(row.mime_type);
    res.sendFile(
      row.file_name,
      { root: MUSIC_DIR, acceptRanges: true, maxAge: '1d' },
      (err) => {
        if (!err) return;
        if (err.code === 'ECONNABORTED' || err.code === 'ECANCELED') return;
        console.error('[tracks] stream error:', err.message);
        if (!res.headersSent) sendError(res, 404, 'Audio file missing.');
      }
    );
  } catch (err) {
    console.error('[tracks] streamTrack error:', err);
    if (!res.headersSent) sendError(res, 500, 'Server error.');
  }
}

// ── POST /api/tracks/:id/play ───────────────────────────────
async function recordPlay(req, res) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return sendError(res, 400, 'Invalid track ID.');

  try {
    const row = await TrackModel.getById(id);
    if (!row) return sendError(res, 404, 'Track not found.');
    await TrackModel.incrementPlayCount(id);
    return sendOk(res, 200, 'Play recorded.', null);
  } catch (err) {
    console.error('[tracks] recordPlay error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ── DELETE /api/tracks/:id ──────────────────────────────────
async function deleteTrack(req, res) {
  const id     = parseInt(req.params.id);
  const userId = req.actorId;
  if (isNaN(id)) return sendError(res, 400, 'Invalid track ID.');

  try {
    const row = await TrackModel.getById(id);
    if (!row) return sendError(res, 404, 'Track not found.');
    if (row.user_id !== userId) {
      return sendError(res, 403, 'You can only delete your own tracks.');
    }

    await TrackModel.remove(id);
    deleteFileQuietly(path.join(MUSIC_DIR, row.file_name));
    return sendOk(res, 200, 'Track deleted.', null);
  } catch (err) {
    console.error('[tracks] deleteTrack error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = {
  createTrack,
  getTracks,
  getTrackById,
  streamTrack,
  recordPlay,
  deleteTrack,
};