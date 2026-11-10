// utils/videoPresets.js
//
// CRF = Constant Rate Factor (lower = better quality, bigger file)
// maxrate + bufsize = hard bitrate ceiling (VBV-constrained CRF)
//
// These values are tuned for MOBILE-first delivery:
//   • CRF 25–28 is indistinguishable from CRF 23 on a phone screen
//   • maxrate caps protect against motion-heavy content
//   • audio is dialled back — nobody notices 64k vs 128k on mobile
//
// Expected sizes for a 6-min video (heavy motion, at cap):
//   360p  ~22 MB    480p  ~46 MB    720p  ~92 MB    1080p ~137 MB
// Simple scenes (talking head) will come in 40–60% under these.

const VIDEO_PRESETS = [
  { quality: '360p',  box:  640, crf: 28, maxrate:  '500k', bufsize: '1000k', audioBitrate: '64k'  },
  { quality: '480p',  box:  854, crf: 27, maxrate: '1000k', bufsize: '2000k', audioBitrate: '96k'  },
  { quality: '720p',  box: 1280, crf: 26, maxrate: '2000k', bufsize: '4000k', audioBitrate: '128k' },
  { quality: '1080p', box: 1920, crf: 25, maxrate: '3000k', bufsize: '6000k', audioBitrate: '128k' },
];

/**
 * Cloudinary equivalent. c_limit + q_auto already does quality-
 * based encoding server-side, so we just cap the dimensions here.
 */
function getCloudinaryVideoRenditions(secureUrl) {
  if (!secureUrl || typeof secureUrl !== 'string') return [];
  if (!secureUrl.includes('/video/upload/')) return [];

  return VIDEO_PRESETS.map((p) => ({
    quality: p.quality,
    width: p.box,
    height: p.box,
    url: secureUrl.replace(
      '/video/upload/',
      `/video/upload/c_limit,w_${p.box},h_${p.box},q_auto/`
    ),
  }));
}

module.exports = { VIDEO_PRESETS, getCloudinaryVideoRenditions };