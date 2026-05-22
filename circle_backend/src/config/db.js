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

async function connectDB() {
  try {
    const conn = await db.getConnection();

    console.log('✅ Successfully connected to MySQL');

    // ── RUN MIGRATIONS HERE ──
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS verify_code VARCHAR(6) NULL,
        ADD COLUMN IF NOT EXISTS verify_code_expires DATETIME NULL,
        ADD COLUMN IF NOT EXISTS email_verified TINYINT(1) NOT NULL DEFAULT 0
    `);

    console.log('✅ Database migrations completed');

    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('Host:', process.env.DB_HOST);
    console.error('Port:', process.env.DB_PORT);
    console.error('User:', process.env.DB_USER);
    console.error('Database:', process.env.DB_NAME);
  }
}

module.exports = { db, connectDB };