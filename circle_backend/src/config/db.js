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
    `
    SELECT COUNT(*) as count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [table, column]
  );

  return rows[0].count > 0;
}

/**
 * Run safe migrations
 */
async function runMigrations() {
  try {
    if (!(await columnExists('notifications', 'message'))) {
      await db.query(`
        ALTER TABLE notifications
        ADD COLUMN message VARCHAR(255) NULL
      `);
      console.log('✅ Added notifications.message');
    }

    if (!(await columnExists('users', 'username'))) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN username VARCHAR(25) NULL UNIQUE
      `);
      console.log('✅ Added users.username');
    }

    console.log('✅ Database migrations completed');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
}

/**
 * Test DB connection
 */
async function connectDB() {
  try {
    const conn = await db.getConnection();

    console.log('✅ Successfully connected to MySQL');

    conn.release();

    // Run migrations AFTER successful connection
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