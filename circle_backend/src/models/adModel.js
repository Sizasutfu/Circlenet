// models/adModel.js
const { db } = require('../config/db');

/**
 * Get a random active ad for a given placement and optional page target.
 * Returns null if no matching ad found.
 */
async function getRandomAd(placement, pageTarget = null) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let query = `
    SELECT id, title, image_url, link_url, placement, page_target
    FROM ads
    WHERE placement = ?
      AND is_active = 1
      AND start_date <= ?
      AND end_date >= ?
  `;
  const params = [placement, now, now];

  if (pageTarget) {
    query += ` AND (page_target = ? OR page_target IS NULL)`;
    params.push(pageTarget);
  }

  query += ` ORDER BY RAND() LIMIT 1`;

  const [rows] = await db.query(query, params);
  return rows[0] || null;
}

/**
 * Create a new ad.
 */
async function createAd(data) {
  const { title, image_url, link_url, placement, page_target, start_date, end_date } = data;
  const [result] = await db.query(
    `INSERT INTO ads (title, image_url, link_url, placement, page_target, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, image_url, link_url, placement, page_target || null, start_date, end_date]
  );
  return result.insertId;
}

/**
 * Update an existing ad.
 */
async function updateAd(id, data) {
  const { title, image_url, link_url, placement, page_target, start_date, end_date, is_active } = data;
  await db.query(
    `UPDATE ads SET
       title = ?,
       image_url = ?,
       link_url = ?,
       placement = ?,
       page_target = ?,
       start_date = ?,
       end_date = ?,
       is_active = ?
     WHERE id = ?`,
    [title, image_url, link_url, placement, page_target || null, start_date, end_date, is_active, id]
  );
}

/**
 * Delete an ad.
 */
async function deleteAd(id) {
  await db.query(`DELETE FROM ads WHERE id = ?`, [id]);
}

/**
 * Get all ads (with optional filters) – for admin listing.
 */
async function getAds(filters = {}) {
  let query = 'SELECT * FROM ads WHERE 1=1';
  const params = [];
  if (filters.placement) {
    query += ' AND placement = ?';
    params.push(filters.placement);
  }
  if (filters.is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(filters.is_active ? 1 : 0);
  }
  query += ' ORDER BY created_at DESC';
  const [rows] = await db.query(query, params);
  return rows;
}

/**
 * Increment impression count for an ad.
 */
async function incrementImpression(id) {
  await db.query(`UPDATE ads SET impressions = impressions + 1 WHERE id = ?`, [id]);
}

/**
 * Increment click count for an ad.
 */
async function incrementClick(id) {
  await db.query(`UPDATE ads SET clicks = clicks + 1 WHERE id = ?`, [id]);
}

module.exports = {
  getRandomAd,
  createAd,
  updateAd,
  deleteAd,
  getAds,
  incrementImpression,
  incrementClick,
};