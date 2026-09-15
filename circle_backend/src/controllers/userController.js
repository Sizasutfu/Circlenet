// ============================================================
//  controllers/userController.js
//  Handles all request/response logic for user routes.
//  Each function reads from req, calls the model, and
//  sends back a response. No SQL lives here.
// ============================================================

const bcrypt            = require('bcrypt');
const { generateToken } = require('../utils/jwt');
const UserModel         = require('../models/userModel');
const FollowModel       = require('../models/followModel');
const NotificationModel = require('../models/notificationModel');
const { sendOk, sendError } = require('../middleware/response');

const IS_PROD = process.env.NODE_ENV === 'production';

// ─── Username generator ────────────────────────────────────────────────────────

/**
 * Converts a display name to a clean username slug.
 * "Siza Mndzawe" → "siza_mndzawe"
 * Appends a random suffix if the username is already taken.
 */
async function generateUsername(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')   // remove special chars
    .replace(/\s+/g, '_')           // spaces → underscores
    .slice(0, 20);                  // max 20 chars

  if (!(await UserModel.usernameExists(base))) return base;

  let username;
  do {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${base}_${suffix}`.slice(0, 25);
  } while (await UserModel.usernameExists(username));

  return username;
}

/**
 * Resolves the stored URL for an uploaded image.
 * Dev  → /uploads/<filename>  (served statically by Express)
 * Prod → Cloudinary secure_url
 */
function resolveFileUrl(compressed) {
  if (!compressed) return null;
  return IS_PROD
    ? compressed.secure_url
    : `/uploads/${compressed.filename}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Cleans and validates the extra profile fields coming from req.body.
 * Returns a safe `extras` object ready to pass into the model.
 */
function extractExtras(body) {
  const {
    phone, location, school,
    occupation, website, dateOfBirth, gender,
  } = body || {};

  const cleanPhone = phone
    ? String(phone).replace(/[^\d+\-\s()|]/g, '').slice(0, 25) || null
    : null;

  return {
    phone:       cleanPhone,
    location:    location    ? String(location).slice(0, 120).trim()   || null : null,
    school:      school      ? String(school).slice(0, 120).trim()     || null : null,
    occupation:  occupation  ? String(occupation).slice(0, 100).trim() || null : null,
    website:     website     ? String(website).slice(0, 255).trim()    || null : null,
    dateOfBirth: dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ? dateOfBirth : null,
    gender:      gender      ? String(gender).slice(0, 30).trim()      || null : null,
  };
}

// ─── POST /api/users/register ──────────────────────────────────────────────────

async function register(req, res) {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return sendError(res, 400, 'Name, email, and password are required.');

  try {
    if (await UserModel.emailExists(email))
      return sendError(res, 409, 'Email already registered.');

    const hash     = await bcrypt.hash(password, 10);
    const username = await generateUsername(name);
    const userId   = await UserModel.createUser(name, email, hash, username);

    return sendOk(res, 201, 'Registered successfully.', {
      id: userId, name, email, username, picture: null, createdAt: new Date(),
    });
  } catch (err) {
    console.error('register error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── POST /api/users/login ─────────────────────────────────────────────────────

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password)
    return sendError(res, 400, 'Email and password are required.');

  try {
    const user = await UserModel.findByEmail(email);
    if (!user) return sendError(res, 404, 'No account with that email.');

    if (user.deleted_at) {
      return sendError(res, 403, 'Your account has been deleted. You can restore it within 30 days.');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return sendError(res, 401, 'Wrong password.');

    if (!user.email_verified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        unverified: true,
      });
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    const { password: _, email_verified: __, deleted_at: ___, ...safeUser } = user;
    return sendOk(res, 200, 'Login successful.', { ...safeUser, token });
  } catch (err) {
    console.error('login error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users/:id/profile ───────────────────────────────────────────────

async function getProfile(req, res) {
  const param = req.params.id;
  const viewerId = parseInt(req.headers['x-user-id']) || null;

  try {
    let targetId;
    if (/^\d+$/.test(param)) {
      targetId = parseInt(param);
    } else {
      const user = await UserModel.getByUsername(param);
      if (!user) return sendError(res, 404, 'User not found.');
      targetId = user.id;
    }

    const profile = await UserModel.getProfile(targetId, viewerId);
    if (!profile) return sendError(res, 404, 'User not found.');
    return sendOk(res, 200, 'Profile fetched.', profile);
  } catch (err) {
    console.error('getProfile error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id/picture ───────────────────────────────────────────────

async function updatePicture(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId)
    return sendError(res, 403, 'Forbidden.');

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const pictureUrl = resolveFileUrl(req.compressedFiles?.image);

    await UserModel.updatePicture(userId, pictureUrl);

    const followerIds = await FollowModel.getFollowerIds(userId);
    await Promise.all(
      followerIds.map(fId =>
        NotificationModel.createNotification(fId, userId, 'profile_pic', null)
      )
    );

    return sendOk(res, 200, 'Picture updated.', { picture: pictureUrl });
  } catch (err) {
    console.error('updatePicture error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id/cover ─────────────────────────────────────────────────

async function updateCoverImage(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId)
    return sendError(res, 403, 'Forbidden.');

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    const coverUrl = resolveFileUrl(req.compressedFiles?.image);

    await UserModel.updateCoverImage(userId, coverUrl);

    return sendOk(res, 200, 'Cover image updated.', { coverImage: coverUrl });
  } catch (err) {
    console.error('updateCoverImage error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
// Supports partial updates — only fields present in req.body are changed.
// Safe when the client sends files only (req.body will be an empty object).

async function updateProfile(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId) {
    return sendError(res, 403, 'Forbidden.');
  }

  // ✅ Guard: req.body may be undefined when the client sends only a file
  //    or an empty multipart body. Default to an empty object so the merge
  //    logic below treats every field as "not provided".
  const body = req.body || {};

  try {
    const existing = await UserModel.findById(userId);
    if (!existing) return sendError(res, 404, 'User not found.');

    // ── Merge: use incoming value if provided, otherwise keep existing ──
    const name = body.name !== undefined
      ? String(body.name).trim()
      : existing.name;

    const email = body.email !== undefined
      ? String(body.email).trim()
      : existing.email;

    const password = body.password;

    const bio = body.bio !== undefined
      ? (String(body.bio).slice(0, 160).trim() || null)
      : existing.bio;

    if (!name || !email) {
      return sendError(res, 400, 'Name and email are required.');
    }

    const clean = (v, max) =>
      v != null ? String(v).slice(0, max).trim() || null : null;

    const extras = {
      phone: body.phone !== undefined
        ? clean(body.phone, 25)
        : existing.phone,

      location: body.location !== undefined
        ? clean(body.location, 120)
        : existing.location,

      school: body.school !== undefined
        ? clean(body.school, 120)
        : existing.school,

      occupation: body.occupation !== undefined
        ? clean(body.occupation, 100)
        : existing.occupation,

      website: body.website !== undefined
        ? clean(body.website, 255)
        : existing.website,

      dateOfBirth: body.dateOfBirth !== undefined
        ? (body.dateOfBirth &&
            /^\d{4}-\d{2}-\d{2}$/.test(body.dateOfBirth)
              ? body.dateOfBirth
              : null)
        : existing.dateOfBirth,

      gender: body.gender !== undefined
        ? clean(body.gender, 30)
        : existing.gender,
    };

    // ── Email uniqueness check (only if actually changing) ──
    if (email !== existing.email && (await UserModel.emailTakenByOther(email, userId))) {
      return sendError(res, 409, 'Email already in use.');
    }

    // ── Optional username change (per-field screens may send this) ──
    if (body.username !== undefined) {
      const raw = String(body.username).trim().toLowerCase();
      if (raw !== (existing.username || '').toLowerCase()) {
        if (!/^[a-z0-9_]{3,25}$/.test(raw)) {
          return sendError(
            res,
            400,
            'Username must be 3–25 characters and contain only letters, numbers, or underscores.'
          );
        }
        if (await UserModel.usernameExists(raw, userId)) {
          return sendError(res, 409, 'Username already taken.');
        }
        await UserModel.updateUsername(userId, raw);
      }
    }

    // ── Apply the update ──
    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      await UserModel.updateUserWithPassword(userId, name, email, hash, bio, extras);
    } else {
      await UserModel.updateUser(userId, name, email, bio, extras);
    }

    const updated = await UserModel.findById(userId);
    return sendOk(res, 200, 'Profile updated.', updated);
  } catch (err) {
    console.error('updateProfile error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id/password (change password) ──────────────────────────

async function changePassword(req, res) {
  const userId = parseInt(req.params.id);
  if (req.actorId !== userId)
    return sendError(res, 403, 'You can only change your own password.');

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword)
    return sendError(res, 400, 'Current password and new password are required.');

  if (newPassword.length < 6)
    return sendError(res, 400, 'New password must be at least 6 characters.');

  try {
    const user = await UserModel.findByIdWithPassword(userId);
    if (!user)
      return sendError(res, 404, 'User not found.');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return sendError(res, 401, 'Current password is incorrect.');

    const hashed = await bcrypt.hash(newPassword, 10);
    await UserModel.updatePassword(userId, hashed);

    return sendOk(res, 200, 'Password changed successfully.');
  } catch (err) {
    console.error('changePassword error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users?search=<query>&limit=<n> ──────────────────────────────────

async function searchUsers(req, res) {
  const search = (req.query.search || '').trim();
  const limit  = Math.min(parseInt(req.query.limit) || 10, 20);
  const selfId = req.actorId;

  if (!search) {
    return sendOk(res, 200, 'No query provided.', []);
  }

  try {
    const users = await UserModel.searchUsers(search, selfId, limit);
    return sendOk(res, 200, 'Users fetched.', users);
  } catch (err) {
    console.error('searchUsers error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users/new-members?limit=10 ──────────────────────────────────────

async function getNewMembers(req, res) {
  const limit    = Math.min(parseInt(req.query.limit) || 10, 20);
  const viewerId = req.actorId || null;

  try {
    const users = await UserModel.getNewMembers(viewerId, limit);
    return sendOk(res, 200, 'New members fetched.', users);
  } catch (err) {
    console.error('getNewMembers error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id/username ──────────────────────────────────────────────

async function updateUsername(req, res) {
  const userId = parseInt(req.params.id);
  if (req.actorId !== userId) return sendError(res, 403, 'Forbidden.');

  const raw = ((req.body || {}).username || '').trim().toLowerCase();

  if (!/^[a-z0-9_]{3,25}$/.test(raw))
    return sendError(res, 400, 'Username must be 3–25 characters and contain only letters, numbers, or underscores.');

  try {
    if (await UserModel.usernameExists(raw, userId))
      return sendError(res, 409, 'Username already taken.');

    await UserModel.updateUsername(userId, raw);
    return sendOk(res, 200, 'Username updated.', { username: raw });
  } catch (err) {
    console.error('updateUsername error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users/by-username/:username ────────────────────────────────────

async function getUserByUsername(req, res) {
  try {
    const { username } = req.params;
    const user = await UserModel.getByUsername(username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error('getUserByUsername error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── PUT /api/users/:id/verify (Admin only) ──────────────────────────────────

async function toggleVerification(req, res) {
  const userId = parseInt(req.params.id);
  const { verified } = req.body || {};

  if (!req.user || !req.user.isAdmin) {
    return sendError(res, 403, 'Admin privileges required.');
  }

  if (typeof verified !== 'boolean') {
    return sendError(res, 400, 'Field "verified" must be a boolean.');
  }

  try {
    await UserModel.updateVerification(userId, verified);
    return sendOk(res, 200, 'Verification status updated.', { verified });
  } catch (err) {
    console.error('toggleVerification error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

async function deleteAccount(req, res) {
  const userId = parseInt(req.params.id);

  console.log('📝 DELETE /api/users/:id');
  console.log('📝 User ID:', userId);
  console.log('📝 req.actorId:', req.actorId);
  console.log('📝 req.body:', req.body);
  console.log('📝 Content-Type:', req.headers['content-type']);

  let body = req.body;

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    if (req.rawBody) {
      try {
        body = JSON.parse(req.rawBody);
        console.log('📝 Parsed from raw body:', body);
      } catch (err) {
        console.error('📝 Failed to parse raw body:', err);
      }
    }
  }

  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Request body is missing. Please ensure Content-Type: application/json is set.'
    });
  }

  const { email, password } = body;

  if (req.actorId !== userId) {
    return sendError(res, 403, 'You can only delete your own account.');
  }

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required to delete your account.');
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return sendError(res, 400, 'Please provide a valid email address.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return sendError(res, 400, 'Password must be at least 6 characters.');
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found or already deleted.');
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return sendError(res, 401, 'Email does not match our records.');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendError(res, 401, 'Incorrect password.');
    }

    await UserModel.softDeleteUser(userId);

    const status = await UserModel.getDeletionStatus(userId);

    return sendOk(res, 200, 'Your account has been scheduled for deletion.', {
      message: 'Your account will be permanently deleted in 30 days. You can restore your account at any time during this period by logging in.',
      deletedAt: status?.deletedAt,
      daysRemaining: status?.daysRemaining || 30,
    });
  } catch (err) {
    console.error('deleteAccount error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── POST /api/users/restore ──────────────────────────────────────────────────

async function restoreAccount(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required.');
  }

  try {
    const user = await UserModel.findDeletedByEmail(email);
    if (!user) {
      return sendError(res, 404, 'No deleted account found with that email.');
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return sendError(res, 401, 'Wrong password.');
    }

    const status = await UserModel.getDeletionStatus(user.id);
    if (status && status.daysRemaining <= 0) {
      return sendError(res, 410, 'Your account has been permanently deleted and cannot be restored.');
    }

    await UserModel.restoreUser(user.id);

    const token = generateToken({ id: user.id, email: user.email, name: user.name });

    const restoredUser = await UserModel.findById(user.id);
    const { password: _, deleted_at: __, ...safeUser } = restoredUser;

    return sendOk(res, 200, 'Account restored successfully.', {
      ...safeUser,
      token,
      message: 'Your account has been restored. Welcome back!',
    });
  } catch (err) {
    console.error('restoreAccount error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users/:id/deletion-status ──────────────────────────────────────

async function getDeletionStatus(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId) {
    return sendError(res, 403, 'You can only check your own account status.');
  }

  try {
    const status = await UserModel.getDeletionStatus(userId);
    if (!status) {
      return sendOk(res, 200, 'Account is active.', { isDeleted: false });
    }

    return sendOk(res, 200, 'Account deletion status.', {
      isDeleted: true,
      deletedAt: status.deletedAt,
      daysRemaining: Math.max(0, status.daysRemaining),
      canRestore: status.daysRemaining > 0,
    });
  } catch (err) {
    console.error('getDeletionStatus error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  register,
  login,
  getProfile,
  updatePicture,
  updateCoverImage,
  updateProfile,
  updateUsername,
  changePassword,
  searchUsers,
  getNewMembers,
  getUserByUsername,
  toggleVerification,
  deleteAccount,
  restoreAccount,
  getDeletionStatus,
};