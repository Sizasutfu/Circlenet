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
    // ----- Existing column migrations -----
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

    // ----- New article tables migrations (fixed foreign key types) -----
    // 1. articles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        user_id      INT              NOT NULL,   -- changed from INT UNSIGNED to INT to match users.id
        title        VARCHAR(255)     NOT NULL,
        excerpt      TEXT,
        content      LONGTEXT         NOT NULL,
        cover_image  VARCHAR(500),
        published    TINYINT(1)       NOT NULL DEFAULT 0,
        created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_articles_user     (user_id),
        KEY idx_articles_published (published, created_at),
        CONSTRAINT fk_articles_user
          FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Ensured articles table');

    // 2. article_tags table
    await db.query(`
      CREATE TABLE IF NOT EXISTS article_tags (
        article_id   INT UNSIGNED     NOT NULL,
        tag          VARCHAR(80)      NOT NULL,
        PRIMARY KEY (article_id, tag),
        KEY idx_article_tags_tag (tag),
        CONSTRAINT fk_article_tags_article
          FOREIGN KEY (article_id) REFERENCES articles (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Ensured article_tags table');

    // 3. article_likes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS article_likes (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        user_id      INT              NOT NULL,   -- changed to INT
        article_id   INT UNSIGNED     NOT NULL,
        created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_article_like (user_id, article_id),
        KEY idx_article_likes_article (article_id),
        CONSTRAINT fk_article_likes_user
          FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_article_likes_article
          FOREIGN KEY (article_id) REFERENCES articles (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Ensured article_likes table');

    // 4. article_echoes table
    await db.query(`
      CREATE TABLE IF NOT EXISTS article_echoes (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        user_id      INT              NOT NULL,   -- changed to INT
        article_id   INT UNSIGNED     NOT NULL,
        created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_article_echo (user_id, article_id),
        KEY idx_article_echoes_article (article_id),
        CONSTRAINT fk_article_echoes_user
          FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_article_echoes_article
          FOREIGN KEY (article_id) REFERENCES articles (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Ensured article_echoes table');

    // 5. article_comments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS article_comments (
        id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
        article_id   INT UNSIGNED     NOT NULL,
        user_id      INT              NOT NULL,   -- changed to INT
        parent_id    INT UNSIGNED              DEFAULT NULL,
        text         TEXT             NOT NULL,
        created_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_article_comments_article (article_id),
        KEY idx_article_comments_parent  (parent_id),
        CONSTRAINT fk_article_comments_article
          FOREIGN KEY (article_id) REFERENCES articles (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_article_comments_user
          FOREIGN KEY (user_id) REFERENCES users (id)
          ON DELETE CASCADE,
        CONSTRAINT fk_article_comments_parent
          FOREIGN KEY (parent_id) REFERENCES article_comments (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Ensured article_comments table');

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