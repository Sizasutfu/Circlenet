// ============================================================
//  middleware/upload.js
//
//  Development  → memoryStorage, your existing compress
//                 middleware writes the file to disk as before.
//
//  Production   → memoryStorage → uploadToCloudinary()
//                 streams the buffer straight to Cloudinary.
//                 Result is attached to req.file.cloudinary
//                 { url, secure_url, public_id, resource_type, … }
// ============================================================

const multer    = require('multer');
const streamifier = require('streamifier');

const IS_PROD = process.env.NODE_ENV === 'production';

// Lazy-load Cloudinary so the SDK is never required in dev
let cloudinary;
if (IS_PROD) {
  cloudinary = require('./cloudinary');
}

// ── Allowed MIME types ────────────────────────────────────────
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

function fileFilter(_req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed.`), false);
  }
}

// ── Multer instance (same for both envs — buffer in RAM) ──────
const upload = multer({
  storage: multer.memoryStorage(),  // compress middleware handles disk write in dev
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB ceiling (pre-compression)
});

// ── Cloudinary streaming helper ───────────────────────────────
/**
 * Streams every file in req.file (single) or req.files (fields/array)
 * up to Cloudinary in parallel, attaching the result back onto each
 * file object as file.cloudinary = { secure_url, public_id, … }.
 *
 * Works for upload.single(), upload.array(), and upload.fields().
 */
function uploadToCloudinary(req, res, next) {
  const folder = process.env.CLOUDINARY_FOLDER || 'circlenet';

  // Helper: upload one file object, resolve with the same file object
  function uploadOne(file) {
    return new Promise((resolve, reject) => {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (error, result) => {
          if (error) return reject(error);
          file.cloudinary = result;  // attach result directly onto the file
          resolve(file);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
  }

  // Collect all files regardless of how multer stored them
  const uploads = [];

  if (req.file) {
    // upload.single()
    uploads.push(uploadOne(req.file));
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      // upload.array()
      req.files.forEach(f => uploads.push(uploadOne(f)));
    } else {
      // upload.fields() — req.files is { fieldname: [file, …], … }
      Object.values(req.files).forEach(arr =>
        arr.forEach(f => uploads.push(uploadOne(f)))
      );
    }
  }

  if (!uploads.length) return next();  // no files attached, move on

  Promise.all(uploads)
    .then(() => next())
    .catch(next);
}

// ── Exports ───────────────────────────────────────────────────
//
//  Usage in routes (unchanged call signature):
//
//    const upload = require('../middleware/upload');
//
//    // single file
//    router.post('/post', upload.single('media'), yourHandler);
//
//    // multiple files
//    router.post('/post', upload.array('media', 5), yourHandler);
//
//  In your handler, read the file reference with the helper:
//
//    const { getFileRef } = require('../middleware/upload');
//    const file = getFileRef(req);
//    // dev  → { path, mimetype, size, originalname, … }  (disk path via compress)
//    // prod → { secure_url, public_id, resource_type, … } (Cloudinary result)
//

if (IS_PROD) {
  // Wrap each multer method so uploadToCloudinary always runs after
  const _single = upload.single.bind(upload);
  const _array  = upload.array.bind(upload);
  const _fields = upload.fields.bind(upload);

  upload.single = (field) => [_single(field), uploadToCloudinary];
  upload.array  = (field, max) => [_array(field, max), uploadToCloudinary];
  upload.fields = (fields) => [_fields(fields), uploadToCloudinary];
}

/**
 * Normalise the file reference across environments.
 *
 *   dev  → returns req.file as-is (your compress middleware
 *           will have populated path, etc.)
 *   prod → returns req.file.cloudinary
 */
function getFileRef(req) {
  if (!req.file) return null;
  return IS_PROD ? req.file.cloudinary : req.file;
}

module.exports = upload;
module.exports.getFileRef      = getFileRef;
module.exports.uploadToCloudinary = uploadToCloudinary; // escape hatch if needed