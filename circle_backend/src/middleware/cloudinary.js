// ============================================================
//  middleware/cloudinary.js
//  Cloudinary SDK — initialised once, imported by upload.js
//  Requires these env vars in production:
//    CLOUDINARY_CLOUD_NAME
//    CLOUDINARY_API_KEY
//    CLOUDINARY_API_SECRET
// ============================================================

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;