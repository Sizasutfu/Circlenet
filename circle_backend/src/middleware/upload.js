// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const streamifier = require('streamifier');

// ── Cloudinary config ──────────────────────────────────────────
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Local storage fallback ────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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

// ── Multer instance ────────────────────────────────────────────
const maxFileSize = process.env.NODE_ENV === 'production' 
  ? 50 * 1024 * 1024   // 50 MB
  : 200 * 1024 * 1024; // 200 MB (dev)

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: maxFileSize },
});

// ── Cloudinary streaming helper (for middleware) ──────────────
function uploadToCloudinary(req, res, next) {
  const folder = process.env.CLOUDINARY_FOLDER || 'circlenet';

  function uploadOne(file) {
    return new Promise((resolve, reject) => {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (error, result) => {
          if (error) return reject(error);
          file.cloudinary = result;
          resolve(file);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });
  }

  const uploads = [];

  if (req.file) {
    uploads.push(uploadOne(req.file));
  }

  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach(f => uploads.push(uploadOne(f)));
    } else {
      Object.values(req.files).forEach(arr =>
        arr.forEach(f => uploads.push(uploadOne(f)))
      );
    }
  }

  if (!uploads.length) return next();

  Promise.all(uploads)
    .then(() => next())
    .catch(next);
}

// ── Standalone uploadImage function (for programmatic use) ────
async function uploadImage(buffer, filename) {
  // If Cloudinary credentials exist, use Cloudinary
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'whispers',
            use_filename: true,
            unique_filename: true,
          },
          (error, result) => {
            if (error) {
              console.error('[Cloudinary] Upload error:', error);
              reject(error);
            } else {
              resolve(result.secure_url);
            }
          }
        );
        uploadStream.end(buffer);
      });
    } catch (err) {
      console.warn('[Cloudinary] Upload failed, falling back to local storage:', err);
      // Fall through to local storage
    }
  }

  // ── Fallback: save locally ──
  const ext = path.extname(filename) || '.png';
  const name = crypto.randomBytes(16).toString('hex') + ext;
  const filepath = path.join(uploadDir, name);
  try {
    await promisify(fs.writeFile)(filepath, buffer);
    return `/uploads/${name}`;
  } catch (err) {
    console.error('[Local storage] Write error:', err);
    throw new Error('Image upload failed');
  }
}

// ── Export ──────────────────────────────────────────────────────
module.exports = upload;
module.exports.getFileRef = (req) => {
  if (!req.file) return null;
  return process.env.NODE_ENV === 'production' ? req.file.cloudinary : req.file;
};
module.exports.uploadToCloudinary = uploadToCloudinary;
module.exports.uploadImage = uploadImage;