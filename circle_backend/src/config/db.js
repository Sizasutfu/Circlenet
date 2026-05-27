const mysql = require('mysql2/promise');

const db = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'circle_db',

      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    });

/**
 * Check if a column exists in a table
 * (Query removed – now returns false)
 */
async function columnExists(table, column) {
  // Original query removed to prevent migration execution
  return false;
}

/**
 * Run safe migrations
 * (All SQL queries removed – only comments remain)
 */
async function runMigrations() {
  // ----- Existing column migrations -----
  // if (!(await columnExists('notifications', 'message'))) {
  //   ALTER TABLE notifications ADD COLUMN message VARCHAR(255) NULL
  // }

  // if (!(await columnExists('users', 'username'))) {
  //   ALTER TABLE users ADD COLUMN username VARCHAR(25) NULL UNIQUE
  // }

  // ----- New article tables migrations (fixed foreign key types) -----
  // 1. articles table
  // CREATE TABLE IF NOT EXISTS articles ( ... )

  // 2. article_tags table
  // CREATE TABLE IF NOT EXISTS article_tags ( ... )

  // 3. article_likes table
  // CREATE TABLE IF NOT EXISTS article_likes ( ... )

  // 4. article_echoes table
  // CREATE TABLE IF NOT EXISTS article_echoes ( ... )

  // 5. article_comments table
  // CREATE TABLE IF NOT EXISTS article_comments ( ... )

  // ----- slug column on articles -----
  // if (!(await columnExists('articles', 'slug'))) {
  //   ALTER TABLE articles ADD COLUMN slug VARCHAR(300) NULL
  // }
  // Back-fill NULL slugs and add unique index queries removed.

  console.log('✅ Database migrations skipped (queries removed)');
}

/**
 * Test DB connection
 */
async function connectDB() {
  try {
    const conn = await db.getConnection();

    console.log('✅ Successfully connected to MySQL');

    conn.release();

    // Migrations are no longer called automatically
    // await runMigrations();  // <-- intentionally commented/removed
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('Host:', process.env.DB_HOST);
    console.error('Port:', process.env.DB_PORT);
    console.error('User:', process.env.DB_USER);
    console.error('Database:', process.env.DB_NAME);
  }
}

module.exports = { db, connectDB };