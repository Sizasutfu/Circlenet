// ============================================================
//  controllers/userController.js
//  Handles all request/response logic for user routes.
//  Each function reads from req, calls the model, and
//  sends back a response. No SQL lives here.
// ============================================================

const bcrypt            = require('bcrypt');
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

  // Check if base is available
  if (!(await UserModel.usernameExists(base))) return base;

  // Append random 4-digit suffix until unique
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
  } = body;

  // Phone is stored as "dialCode|digits", e.g. "+254|712345678"
  // Strip anything that isn't digits, +, -, spaces, (, ) or |
  const cleanPhone = phone
    ? String(phone).replace(/[^\d+\-\s()|]/g, '').slice(0, 25) || null
    : null;

  return {
    phone:       cleanPhone,
    location:    location    ? String(location).slice(0, 120).trim()   || null : null,
    school:      school      ? String(school).slice(0, 120).trim()     || null : null,
    occupation:  occupation  ? String(occupation).slice(0, 100).trim() || null : null,
    website:     website     ? String(website).slice(0, 255).trim()    || null : null,
    // dateOfBirth must be a valid YYYY-MM-DD string or null
    dateOfBirth: dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ? dateOfBirth : null,
    gender:      gender      ? String(gender).slice(0, 30).trim()      || null : null,
  };
}

// ─── POST /api/users/register ──────────────────────────────────────────────────

async function register(req, res) {
  const { name, email, password } = req.body;
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
  const { email, password } = req.body;
  if (!email || !password)
    return sendError(res, 400, 'Email and password are required.');

  try {
    const user = await UserModel.findByEmail(email);
    if (!user) return sendError(res, 404, 'No account with that email.');

    const match = await bcrypt.compare(password, user.password);
    if (!match) return sendError(res, 401, 'Wrong password.');

    // Never send the password hash to the client
    const { password: _, ...safeUser } = user;
    return sendOk(res, 200, 'Login successful.', safeUser);
  } catch (err) {
    console.error('login error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users/:id/profile ───────────────────────────────────────────────

async function getProfile(req, res) {
  const targetId = parseInt(req.params.id);
  const viewerId = parseInt(req.headers['x-user-id']) || null;

  try {
    const profile = await UserModel.getProfile(targetId, viewerId);
    if (!profile) return sendError(res, 404, 'User not found.');
    return sendOk(res, 200, 'Profile fetched.', profile);
  } catch (err) {
    console.error('getProfile error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id/picture ───────────────────────────────────────────────
// Route must use: upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads

async function updatePicture(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId)
    return sendError(res, 403, 'Forbidden.');

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    // compressUploads sets req.compressedFiles.image.
    // resolveFileUrl returns a local path (dev) or Cloudinary URL (prod).
    const pictureUrl = resolveFileUrl(req.compressedFiles?.image);

    await UserModel.updatePicture(userId, pictureUrl);

    // Notify all followers about the new profile picture
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
// Route must use: upload.fields([{ name: 'image', maxCount: 1 }]), compressUploads

async function updateCoverImage(req, res) {
  const userId = parseInt(req.params.id);

  if (req.actorId !== userId)
    return sendError(res, 403, 'Forbidden.');

  try {
    const user = await UserModel.findById(userId);
    if (!user) return sendError(res, 404, 'User not found.');

    // compressUploads sets req.compressedFiles.image.
    // resolveFileUrl returns a local path (dev) or Cloudinary URL (prod).
    const coverUrl = resolveFileUrl(req.compressedFiles?.image);

    await UserModel.updateCoverImage(userId, coverUrl);

    return sendOk(res, 200, 'Cover image updated.', { coverImage: coverUrl });
  } catch (err) {
    console.error('updateCoverImage error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────

async function updateProfile(req, res) {
  const userId = parseInt(req.params.id);
  const { name, email, password, bio } = req.body;

  if (req.actorId !== userId)
    return sendError(res, 403, 'Forbidden.');
  if (!name || !email)
    return sendError(res, 400, 'Name and email are required.');

  // Cap bio at 160 chars and treat empty string as null
  const cleanBio = bio ? String(bio).slice(0, 160).trim() || null : null;

  // Extract and sanitise the extra fields
  const extras = extractExtras(req.body);

  try {
    if (await UserModel.emailTakenByOther(email, userId))
      return sendError(res, 409, 'Email already in use.');

    if (password && password.length >= 6) {
      const hash = await bcrypt.hash(password, 10);
      await UserModel.updateUserWithPassword(userId, name, email, hash, cleanBio, extras);
    } else {
      await UserModel.updateUser(userId, name, email, cleanBio, extras);
    }

    const updated = await UserModel.findById(userId);
    return sendOk(res, 200, 'Profile updated.', updated);
  } catch (err) {
    console.error('updateProfile error:', err);
    return sendError(res, 500, 'Server error.');
  }
}

// ─── GET /api/users?search=<query>&limit=<n> ──────────────────────────────────
// Used by the New Message modal to find people to DM.
// Requires auth (x-user-id header) so the caller is excluded from results.

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
// Returns users who joined in the last 7 days, excluding self and already-followed.

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

  const raw = (req.body.username || '').trim().toLowerCase();

  // Validate: 3–25 chars, letters/numbers/underscores only
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

module.exports = {
  register,
  login,
  getProfile,
  updatePicture,
  updateCoverImage,
  updateProfile,
  updateUsername,
  searchUsers,
  getNewMembers,
};