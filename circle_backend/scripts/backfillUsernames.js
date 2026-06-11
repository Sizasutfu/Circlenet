// scripts/backfillUsernames.js
// Run with: node scripts/backfillUsernames.js

require('dotenv').config();
const { db } = require('../src/config/db');
const UserModel = require('../src/models/userModel');

/**
 * Exact copy of the generateUsername logic from userController.js
 * (we copy it here so the script is self‑contained)
 */
async function generateUsername(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 20);

  if (!(await UserModel.usernameExists(base))) return base;

  let username;
  do {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    username = `${base}_${suffix}`.slice(0, 25);
  } while (await UserModel.usernameExists(username));
  return username;
}

async function backfillUsernames() {
  console.log('🔍 Fetching users with NULL username...');
  const [rows] = await db.query('SELECT id, name FROM users WHERE username IS NULL');

  if (rows.length === 0) {
    console.log('✅ No users need a username.');
    process.exit(0);
  }

  console.log(`📝 Found ${rows.length} users without a username.`);

  let updated = 0;
  for (const user of rows) {
    try {
      const newUsername = await generateUsername(user.name);
      const [result] = await db.query(
        'UPDATE users SET username = ? WHERE id = ? AND username IS NULL',
        [newUsername, user.id]
      );
      if (result.affectedRows === 1) {
        updated++;
        console.log(`✓ User ${user.id} (${user.name}) → ${newUsername}`);
      } else {
        console.warn(`⚠️ User ${user.id} already got a username concurrently.`);
      }
    } catch (err) {
      console.error(`❌ Failed for user ${user.id}:`, err.message);
    }
  }

  console.log(`\n✨ Backfill complete. Updated ${updated} of ${rows.length} users.`);

  // Optional: enforce NOT NULL constraint
  console.log('🔒 Altering table to make username NOT NULL...');
  await db.query('ALTER TABLE users MODIFY username VARCHAR(25) NOT NULL');
  console.log('✅ Table altered successfully.');

  process.exit(0);
}

backfillUsernames().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});