// controllers/adController.js
const AdModel = require('../models/adModel');
const { sendOk, sendError } = require('../middleware/response');

// GET /api/ads?placement=feed&page=profile
async function getAd(req, res) {
  const placement = req.query.placement;
  const pageTarget = req.query.page || null;

  if (!placement) {
    return sendError(res, 400, 'placement parameter is required');
  }

  try {
    const ad = await AdModel.getRandomAd(placement, pageTarget);
    if (!ad) {
      return sendOk(res, 200, 'No ad available', null);
    }
    // Increment impression (optional, but you can do it here or on client-side)
    // We'll increment on the frontend when the ad is rendered.
    return sendOk(res, 200, 'Ad fetched', ad);
  } catch (err) {
    console.error('getAd error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// GET /api/ads/:id (admin only)
async function getAdById(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid ad ID');
  try {
    const ads = await AdModel.getAds({});
    const ad = ads.find(a => a.id === id);
    if (!ad) return sendError(res, 404, 'Ad not found');
    return sendOk(res, 200, 'Ad fetched', ad);
  } catch (err) {
    console.error('getAdById error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// POST /api/ads (admin only)
async function createAd(req, res) {
  // Expect: title, image_url, link_url, placement, page_target, start_date, end_date
  const required = ['title', 'image_url', 'link_url', 'placement', 'start_date', 'end_date'];
  for (const field of required) {
    if (!req.body[field]) {
      return sendError(res, 400, `${field} is required`);
    }
  }

  try {
    const id = await AdModel.createAd(req.body);
    return sendOk(res, 201, 'Ad created', { id });
  } catch (err) {
    console.error('createAd error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// PUT /api/ads/:id (admin only)
async function updateAd(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid ad ID');

  try {
    await AdModel.updateAd(id, req.body);
    return sendOk(res, 200, 'Ad updated');
  } catch (err) {
    console.error('updateAd error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// DELETE /api/ads/:id (admin only)
async function deleteAd(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid ad ID');

  try {
    await AdModel.deleteAd(id);
    return sendOk(res, 200, 'Ad deleted');
  } catch (err) {
    console.error('deleteAd error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// GET /api/ads/list (admin only) – get all ads
async function listAds(req, res) {
  try {
    const ads = await AdModel.getAds(req.query);
    return sendOk(res, 200, 'Ads fetched', ads);
  } catch (err) {
    console.error('listAds error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// POST /api/ads/:id/impression – track impression (frontend calls this when ad is rendered)
async function trackImpression(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid ad ID');
  try {
    await AdModel.incrementImpression(id);
    return sendOk(res, 200, 'Impression recorded');
  } catch (err) {
    console.error('trackImpression error:', err);
    return sendError(res, 500, 'Server error');
  }
}

// POST /api/ads/:id/click – track click (frontend calls this when ad is clicked)
async function trackClick(req, res) {
  const id = parseInt(req.params.id);
  if (!id) return sendError(res, 400, 'Invalid ad ID');
  try {
    await AdModel.incrementClick(id);
    return sendOk(res, 200, 'Click recorded');
  } catch (err) {
    console.error('trackClick error:', err);
    return sendError(res, 500, 'Server error');
  }
}

module.exports = {
  getAd,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
  listAds,
  trackImpression,
  trackClick,
};