// controllers/videoController.js
const { getPostsPage } = require('../feed/feedPipeline');
const { sendOk, sendError } = require('../middleware/response');

/**
 * GET /api/videos?page=1&limit=20
 * Returns a paginated list of video posts, algorithmically scored.
 */
async function getVideos(req, res) {
  const viewerUserId = req.actorId || (req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));

  try {
    // Use the existing feed pipeline with `mediaFilter: 'video'`
    const result = await getPostsPage(viewerUserId, 'global', page, limit, 'video');
    return sendOk(res, 200, 'Videos fetched.', result);
  } catch (err) {
    console.error('getVideos error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

module.exports = { getVideos };