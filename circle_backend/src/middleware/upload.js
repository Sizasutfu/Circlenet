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

// ── Local storage setup ────────────────────────────────────────
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
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp3',
];

function fileFilter(_req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not allowed.`), false);
  }
}

// ── Multer instance ────────────────────────────────────────────
const maxFileSize = 200 * 1024 * 1024; // 200 MB

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: maxFileSize },
});

// ── Determine if Cloudinary is available ──────────────────────
const isCloudinaryAvailable = () => {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && 
            process.env.CLOUDINARY_API_KEY && 
            process.env.CLOUDINARY_API_SECRET);
};

// ── Upload to Cloudinary ──────────────────────────────────────
function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const resourceType = options.resource_type || 'auto';
    const folder = options.folder || process.env.CLOUDINARY_FOLDER || 'circlenet';
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: folder,
        use_filename: true,
        unique_filename: true,
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            thumbnail: result.secure_url.replace('/upload/', '/upload/c_thumb,w_200,h_200/'),
            public_id: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
          });
        }
      }
    );
    uploadStream.end(buffer);
  });
}

// ── Save to local storage ─────────────────────────────────────
async function saveToLocal(buffer, filename, mimetype) {
  const ext = path.extname(filename) || getExtensionFromMime(mimetype) || '.bin';
  const name = crypto.randomBytes(16).toString('hex') + ext;
  const filepath = path.join(uploadDir, name);
  
  await promisify(fs.writeFile)(filepath, buffer);
  
  // Determine if it's an image/video/audio for proper URL
  let type = 'file';
  if (mimetype.startsWith('image/')) type = 'image';
  else if (mimetype.startsWith('video/')) type = 'video';
  else if (mimetype.startsWith('audio/')) type = 'audio';
  
  return {
    url: `/uploads/${name}`,
    thumbnail: type === 'image' ? `/uploads/${name}` : null,
    name: name,
    type: type,
    size: buffer.length,
  };
}

// ── Helper: Get extension from MIME type ──────────────────────
function getExtensionFromMime(mimetype) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
  };
  return map[mimetype] || '.bin';
}

// ── Main upload function ──────────────────────────────────────
async function uploadImage(buffer, filename, options = {}) {
  const mimetype = options.mimetype || 'image/png';
  const folder = options.folder || process.env.CLOUDINARY_FOLDER || 'circlenet';
  const isProd = process.env.NODE_ENV === 'production';
  
  // ── In production: Always use Cloudinary ──────────────────
  if (isProd) {
    if (!isCloudinaryAvailable()) {
      console.error('[Upload] Cloudinary credentials missing in production!');
      throw new Error('Cloudinary configuration missing in production');
    }
    
    try {
      const resourceType = mimetype.startsWith('video/') ? 'video' : 
                          mimetype.startsWith('audio/') ? 'raw' : 'image';
      
      const result = await uploadToCloudinary(buffer, {
        resource_type: resourceType,
        folder: folder,
        ...options,
      });
      
      console.log('[Cloudinary] Upload successful:', result.url);
      return result.url;
    } catch (err) {
      console.error('[Cloudinary] Upload failed in production:', err);
      throw new Error('Failed to upload to Cloudinary');
    }
  }
  
  // ── In development: Use local storage ──────────────────────
  console.log('[Local] Uploading to local storage...');
  const result = await saveToLocal(buffer, filename, mimetype);
  console.log('[Local] Upload successful:', result.url);
  return result.url;
}

// ── Upload with full metadata (for DM media) ──────────────────
async function uploadMediaWithMetadata(buffer, filename, mimetype, options = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  
  // Determine media type
  let mediaType = 'file';
  if (mimetype.startsWith('image/')) mediaType = 'image';
  else if (mimetype.startsWith('video/')) mediaType = 'video';
  else if (mimetype.startsWith('audio/')) mediaType = 'audio';
  
  // ── In production: Cloudinary ──────────────────────────────
  if (isProd) {
    if (!isCloudinaryAvailable()) {
      console.error('[Upload] Cloudinary credentials missing in production!');
      throw new Error('Cloudinary configuration missing in production');
    }
    
    try {
      const resourceType = mediaType === 'video' ? 'video' : 
                          mediaType === 'audio' ? 'raw' : 'image';
      
      const result = await uploadToCloudinary(buffer, {
        resource_type: resourceType,
        folder: options.folder || 'circlenet',
        ...options,
      });
      
      return {
        url: result.url,
        thumbnail: mediaType === 'image' ? result.thumbnail : null,
        type: mediaType,
        name: filename,
        size: buffer.length,
        public_id: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    } catch (err) {
      console.error('[Cloudinary] Upload failed:', err);
      throw new Error('Failed to upload to Cloudinary');
    }
  }
  
  // ── In development: Local storage ──────────────────────────
  const result = await saveToLocal(buffer, filename, mimetype);
  return {
    url: result.url,
    thumbnail: result.thumbnail,
    type: mediaType,
    name: filename,
    size: buffer.length,
  };
}

// ── Multer middleware with Cloudinary integration ─────────────
function uploadToCloudinaryMiddleware(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  
  if (!isProd) {
    // In development, just pass through
    return next();
  }
  
  // In production, upload to Cloudinary
  const uploads = [];
  
  if (req.file) {
    uploads.push(req.file);
  }
  
  if (req.files) {
    if (Array.isArray(req.files)) {
      req.files.forEach(f => uploads.push(f));
    } else {
      Object.values(req.files).forEach(arr =>
        arr.forEach(f => uploads.push(f))
      );
    }
  }
  
  if (!uploads.length) return next();
  
  // Upload each file to Cloudinary
  Promise.all(uploads.map(async (file) => {
    try {
      const resourceType = file.mimetype.startsWith('video/') ? 'video' : 
                          file.mimetype.startsWith('audio/') ? 'raw' : 'image';
      
      const result = await uploadToCloudinary(file.buffer, {
        resource_type: resourceType,
        folder: process.env.CLOUDINARY_FOLDER || 'circlenet',
      });
      
      file.cloudinary = result;
      file.cloudinaryUrl = result.url;
      return file;
    } catch (err) {
      console.error('[Cloudinary] Upload error:', err);
      throw err;
    }
  }))
  .then(() => next())
  .catch(next);
}

// ── Export ──────────────────────────────────────────────────────
module.exports = upload;
module.exports.uploadImage = uploadImage;
module.exports.uploadMediaWithMetadata = uploadMediaWithMetadata;
module.exports.uploadToCloudinary = uploadToCloudinary;
module.exports.uploadToCloudinaryMiddleware = uploadToCloudinaryMiddleware;
module.exports.isCloudinaryAvailable = isCloudinaryAvailable;