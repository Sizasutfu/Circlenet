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
    if (!(await columnExists('users', 'verify_code'))) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN verify_code VARCHAR(6) NULL
      `);
      console.log('✅ Added verify_code');
    }

    if (!(await columnExists('users', 'verify_code_expires'))) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN verify_code_expires DATETIME NULL
      `);
      console.log('✅ Added verify_code_expires');
    }

    if (!(await columnExists('users', 'email_verified'))) {
      await db.query(`
        ALTER TABLE users
        ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0
      `);
      console.log('✅ Added email_verified');
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
