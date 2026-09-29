require('dotenv').config();
const { db } = require('../config/db');

(async () => {
  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'verification_requests'");
    console.log('\nTables match:');
    console.log(tables);

    if (tables.length === 0) {
      console.log('\nverification_requests table is MISSING.');
      process.exit(1);
    }

    console.log('\nTable exists.');

    const [cols] = await db.query('DESCRIBE verification_requests');
    console.log('\nColumns:');
    console.table(cols);

    const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM verification_requests');
    console.log(`\nRow count: ${count}`);

    const [fks] = await db.query(`
      SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'verification_requests'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.log('\nForeign keys:');
    console.log(fks.length ? fks : '  (none - optional)');

    process.exit(0);
  } catch (err) {
    console.error('\nFailed:', err.message);
    process.exit(1);
  }
})();
