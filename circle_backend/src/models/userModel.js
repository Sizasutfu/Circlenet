const { db } = require("../config/db");

const UserModel = {
  // ─── Lookup ────────────────────────────────────────────────────────────────

  async findByEmail(email) {
    const [rows] = await db.query(
      "SELECT id, name, email, password, email_verified, role FROM users WHERE email = ?",
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await db.query(
      `SELECT
         id, name, email, username, bio, picture, cover_image AS coverImage,
         phone, location, school, occupation, website,
         date_of_birth  AS dateOfBirth,
         gender,
         verified,
         role,                  -- ✅ added role
         created_at     AS createdAt
       FROM users WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async emailExists(email) {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    return rows.length > 0;
  },

  async emailTakenByOther(email, excludeId) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, excludeId]
    );
    return rows.length > 0;
  },

  // ─── Create ────────────────────────────────────────────────────────────────

  async createUser(name, email, hashedPassword, username = null) {
    const [result] = await db.query(
      "INSERT INTO users (name, email, password, username) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, username]
    );
    return result.insertId;
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateUser(id, name, email, bio = null, extras = {}) {
    const {
      phone       = null,
      location    = null,
      school      = null,
      occupation  = null,
      website     = null,
      dateOfBirth = null,
      gender      = null,
    } = extras;

    await db.query(
      `UPDATE users
       SET name = ?, email = ?, bio = ?,
           phone = ?, location = ?, school = ?,
           occupation = ?, website = ?,
           date_of_birth = ?, gender = ?
       WHERE id = ?`,
      [name, email, bio, phone, location, school, occupation, website, dateOfBirth, gender, id]
    );
  },

  async updateUserWithPassword(id, name, email, hashedPassword, bio = null, extras = {}) {
    const {
      phone       = null,
      location    = null,
      school      = null,
      occupation  = null,
      website     = null,
      dateOfBirth = null,
      gender      = null,
    } = extras;

    await db.query(
      `UPDATE users
       SET name = ?, email = ?, password = ?, bio = ?,
           phone = ?, location = ?, school = ?,
           occupation = ?, website = ?,
           date_of_birth = ?, gender = ?
       WHERE id = ?`,
      [name, email, hashedPassword, bio, phone, location, school, occupation, website, dateOfBirth, gender, id]
    );
  },

  async updatePicture(id, picture) {
    await db.query("UPDATE users SET picture = ? WHERE id = ?", [picture, id]);
  },

  async updateCoverImage(id, coverImage) {
    await db.query("UPDATE users SET cover_image = ? WHERE id = ?", [coverImage, id]);
  },

  async usernameExists(username, excludeId = null) {
    if (excludeId) {
      const [rows] = await db.query(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username, excludeId]
      );
      return rows.length > 0;
    }
    const [rows] = await db.query(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );
    return rows.length > 0;
  },

  async updateUsername(id, username) {
    await db.query("UPDATE users SET username = ? WHERE id = ?", [username, id]);
  },

  // ─── Verification badge ──────────────────────────────────────────────────

  async updateVerification(id, verified) {
    await db.query("UPDATE users SET verified = ? WHERE id = ?", [verified, id]);
  },

  // ─── E2E encryption public key (used for encrypted DMs) ───────────────────

  async savePublicKey(id, publicKey) {
    await db.query("UPDATE users SET public_key = ? WHERE id = ?", [publicKey, id]);
  },

  async getPublicKey(id) {
    const [rows] = await db.query("SELECT public_key FROM users WHERE id = ?", [id]);
    return rows[0]?.public_key || null;
  },

  // ─── Profile (public view) ─────────────────────────────────────────────────
  // NOTE: phone and dateOfBirth are intentionally excluded — private fields.

  async getProfile(targetId, viewerId = null) {
    const [rows] = await db.query(
      `SELECT
         id, name, username, bio, picture, cover_image AS coverImage,
         location, school, occupation, website, gender,
         verified,
         role                  -- ✅ added role
       FROM users WHERE id = ?`,
      [targetId]
    );
    if (!rows.length) return null;

    const [[{ postCount }]] = await db.query(
      "SELECT COUNT(*) AS postCount FROM posts WHERE user_id = ? AND is_repost = 0",
      [targetId]
    );
    const [[{ followerCount }]] = await db.query(
      "SELECT COUNT(*) AS followerCount FROM follows WHERE following_id = ?",
      [targetId]
    );
    const [[{ followingCount }]] = await db.query(
      "SELECT COUNT(*) AS followingCount FROM follows WHERE follower_id = ?",
      [targetId]
    );

    let isFollowing = false;
    if (viewerId && viewerId !== targetId) {
      const [f] = await db.query(
        "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
        [viewerId, targetId]
      );
      isFollowing = f.length > 0;
    }

    return { ...rows[0], postCount, followerCount, followingCount, isFollowing };
  },

  // ─── Search ────────────────────────────────────────────────────────────────

  async searchUsers(query, excludeId, limit = 10) {
    const like = `%${query}%`;
    const [rows] = await db.query(
      `SELECT id, name, email, picture, role  -- ✅ added role
       FROM users
       WHERE (name LIKE ? OR email LIKE ?)
         AND id != ?
       ORDER BY name ASC
       LIMIT ?`,
      [like, like, excludeId, limit]
    );
    return rows;
  },

  // ─── Password Reset ────────────────────────────────────────────────────────

  async saveResetToken(userId, token, expires) {
    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [token, expires, userId]
    );
  },

  async findByValidResetToken(token) {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
      [token]
    );
    return rows[0] || null;
  },

  async updatePasswordAndClearToken(userId, hashedPassword) {
    await db.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
      [hashedPassword, userId]
    );
  },
};

// ─── New members (joined in last 7 days) ──────────────────────────────────────
// Excludes the viewer and users they already follow.

async function getNewMembers(viewerId, limit = 10) {
  let query, params;

  if (viewerId) {
    query = `
      SELECT
        u.id,
        u.name,
        u.picture,
        u.created_at AS createdAt,
        u.role        -- ✅ added role
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL 7 DAY
        AND u.id != ?
        AND u.id NOT IN (
          SELECT following_id FROM follows WHERE follower_id = ?
        )
      ORDER BY u.created_at DESC
      LIMIT ?
    `;
    params = [viewerId, viewerId, limit];
  } else {
    query = `
      SELECT
        u.id,
        u.name,
        u.picture,
        u.created_at AS createdAt,
        u.role        -- ✅ added role
      FROM users u
      WHERE u.created_at >= NOW() - INTERVAL 7 DAY
      ORDER BY u.created_at DESC
      LIMIT ?
    `;
    params = [limit];
  }

  const [rows] = await db.query(query, params);
  return rows;
}

// ─── Get user by username ──────────────────────────────────────────────────────

async function getByUsername(username) {
  const [rows] = await db.query(
    `SELECT
       id, name, username, email, bio, picture,
       cover_image AS coverImage,
       location, school, occupation, website, gender, phone,
       date_of_birth AS dateOfBirth,
       verified,
       role,                  -- ✅ added role
       created_at  AS joined
     FROM users
     WHERE username = ?`,
    [username]
  );
  return rows.length ? rows[0] : null;
}

// ─── Email verification helpers ───────────────────────────────────────────────

async function saveVerificationCode(userId, code, expires) {
  await db.query(
    `UPDATE users
     SET verify_code = ?, verify_code_expires = ?
     WHERE id = ?`,
    [code, expires, userId]
  );
}

async function findByValidVerificationCode(email, code) {
  const [rows] = await db.query(
    `SELECT * FROM users
     WHERE email = ?
       AND verify_code = ?
       AND verify_code_expires > NOW()
     LIMIT 1`,
    [email, code]
  );
  return rows[0] || null;
}

async function markEmailVerified(userId) {
  await db.query(
    `UPDATE users
     SET email_verified = 1,
         verify_code = NULL,
         verify_code_expires = NULL
     WHERE id = ?`,
    [userId]
  );
}

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  ...UserModel,
  getNewMembers,
  getByUsername,
  saveVerificationCode,
  findByValidVerificationCode,
  markEmailVerified,
};