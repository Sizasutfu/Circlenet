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
 */
async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
    [table, column]
  );
  return rows[0].cnt > 0;
}

/**
 * Run safe migrations
 */
async function runMigrations() {
  if (!(await columnExists('articles', 'view_count'))) {
    await db.query(`ALTER TABLE articles ADD COLUMN view_count INT UNSIGNED NOT NULL DEFAULT 0`);
  }

  if (!(await columnExists('articles', 'updated_at'))) {
    await db.query(`ALTER TABLE articles ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS article_views (
      id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      article_id INT             NOT NULL,
      user_id    INT             NULL,
      ip_hash    VARCHAR(64)     NOT NULL,
      date_only  DATE            NOT NULL,
      viewed_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_view (article_id, user_id, date_only),
      UNIQUE KEY uq_ip_view   (article_id, ip_hash, date_only),
      INDEX idx_article_viewed (article_id, viewed_at),
      INDEX idx_viewed_at      (viewed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✅ Database migrations complete');
}

/**
 * Test DB connection
 */
async function connectDB() {
  try {
    const conn = await db.getConnection();
    console.log('✅ Successfully connected to MySQL');
    conn.release();
    await runMigrations();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('Host:', process.env.DB_HOST);
    console.error('Port:', process.env.DB_PORT);
    console.error('User:', process.env.DB_USER);
    console.error('Database:', process.env.DB_NAME);
  }
}

module.exports = { db, connectDB };