const mysql = require('mysql2/promise');

const db = process.env.DATABASE_URL
  ? mysql.createPool(process.env.DATABASE_URL)
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'circle_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

async function connectDB() {
  try {
    const conn = await db.getConnection();
    console.log('Successfully connected to MySQL');
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { db, connectDB };