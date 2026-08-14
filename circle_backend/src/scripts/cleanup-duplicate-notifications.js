// src/scripts/cleanup-duplicate-notifications.js (final version)
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'circle_db',
    waitForConnections: true,
    connectionLimit: 1,
};

async function cleanupDuplicateNotifications() {
    let connection;
    let totalDeleted = 0;
    const BATCH_SIZE = 500;
    const MAX_ATTEMPTS = 30; // Increased to handle more attempts

    try {
        connection = await mysql.createConnection(dbConfig);
        console.log(`[${new Date().toISOString()}] Starting duplicate notification cleanup...`);

        await connection.execute('SET SQL_SAFE_UPDATES = 0');

        let hasMore = true;
        let attempt = 0;

        while (hasMore && attempt < MAX_ATTEMPTS) {
            attempt++;
            
            // Delete duplicates in batches
            const [result] = await connection.query(
                `DELETE FROM notifications 
                 WHERE id IN (
                     SELECT id FROM (
                         SELECT n1.id
                         FROM notifications n1
                         INNER JOIN notifications n2 
                         WHERE 
                             n1.recipient_id = n2.recipient_id 
                             AND n1.actor_id = n2.actor_id 
                             AND n1.type = n2.type 
                             AND (n1.post_id = n2.post_id OR (n1.post_id IS NULL AND n2.post_id IS NULL))
                             AND n1.created_at < n2.created_at
                         LIMIT ${BATCH_SIZE}
                     ) AS tmp
                 )`
            );

            const deleted = result.affectedRows;
            totalDeleted += deleted;
            
            if (deleted > 0) {
                console.log(`[${new Date().toISOString()}] Attempt ${attempt}: Deleted ${deleted} duplicates (Total: ${totalDeleted})`);
            }

            // If we deleted less than the batch size, we're done
            if (deleted < BATCH_SIZE) {
                hasMore = false;
            }
        }

        // Double-check: Delete any remaining duplicates one by one
        console.log(`[${new Date().toISOString()}] Checking for any remaining duplicates...`);
        
        // Keep deleting until no more duplicates exist
        let remainingDeletes = 1;
        while (remainingDeletes > 0) {
            const [result] = await connection.query(
                `DELETE FROM notifications 
                 WHERE id IN (
                     SELECT id FROM (
                         SELECT n1.id
                         FROM notifications n1
                         INNER JOIN notifications n2 
                         WHERE 
                             n1.recipient_id = n2.recipient_id 
                             AND n1.actor_id = n2.actor_id 
                             AND n1.type = n2.type 
                             AND (n1.post_id = n2.post_id OR (n1.post_id IS NULL AND n2.post_id IS NULL))
                             AND n1.created_at < n2.created_at
                         LIMIT 10
                     ) AS tmp
                 )`
            );
            remainingDeletes = result.affectedRows;
            if (remainingDeletes > 0) {
                totalDeleted += remainingDeletes;
                console.log(`[${new Date().toISOString()}] Deleted ${remainingDeletes} remaining duplicates (Total: ${totalDeleted})`);
            }
        }

        await connection.execute('SET SQL_SAFE_UPDATES = 1');

        // Now try to add the unique constraint
        try {
            // Check if constraint exists
            const [constraintCheck] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM information_schema.STATISTICS 
                 WHERE table_schema = DATABASE() 
                 AND table_name = 'notifications' 
                 AND index_name = 'unique_notification'`
            );

            if (constraintCheck[0].count === 0) {
                console.log(`[${new Date().toISOString()}] Adding unique constraint...`);
                try {
                    await connection.execute(
                        `ALTER TABLE notifications 
                         ADD UNIQUE INDEX unique_notification (recipient_id, actor_id, type, post_id)`
                    );
                    console.log(`[${new Date().toISOString()}] ✅ Unique constraint added successfully.`);
                } catch (constraintError) {
                    console.log(`[${new Date().toISOString()}] ⚠️ Could not add unique constraint:`, constraintError.message);
                    
                    // Show the offending duplicates
                    const [duplicates] = await connection.execute(
                        `SELECT 
                            recipient_id, 
                            actor_id, 
                            type, 
                            post_id, 
                            COUNT(*) as count,
                            GROUP_CONCAT(id) as ids,
                            MIN(created_at) as oldest,
                            MAX(created_at) as newest
                         FROM notifications
                         GROUP BY recipient_id, actor_id, type, post_id
                         HAVING COUNT(*) > 1
                         LIMIT 10`
                    );
                    
                    if (duplicates.length > 0) {
                        console.log(`[${new Date().toISOString()}] Found ${duplicates.length} duplicate groups:`);
                        duplicates.forEach(dup => {
                            console.log(`  - ${dup.recipient_id}-${dup.actor_id}-${dup.type}-${dup.post_id}: ${dup.count} duplicates (IDs: ${dup.ids})`);
                        });
                        console.log(`[${new Date().toISOString()}] 💡 Run this SQL to fix manually: DELETE FROM notifications WHERE id IN (${duplicates.map(d => d.ids.split(',').slice(1).join(',')).join(',')});`);
                    }
                }
            } else {
                console.log(`[${new Date().toISOString()}] ✅ Unique constraint already exists.`);
            }
        } catch (checkError) {
            console.log(`[${new Date().toISOString()}] ⚠️ Could not check for constraint:`, checkError.message);
        }

        console.log(`[${new Date().toISOString()}] ✅ Total duplicate records deleted: ${totalDeleted}`);
        
        return totalDeleted;
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ Error during cleanup:`, error.message);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.execute('SET SQL_SAFE_UPDATES = 1');
            } catch (e) {
                // Ignore
            }
            await connection.end();
        }
    }
}

module.exports = cleanupDuplicateNotifications;