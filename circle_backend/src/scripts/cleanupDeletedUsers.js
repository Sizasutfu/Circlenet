// scripts/cleanupDeletedUsers.js
// Run this script daily via cron job to permanently delete users after 30 days

const { db } = require('../config/db');
const UserModel = require('../models/userModel');

async function cleanupDeletedUsers() {
  console.log('🔄 Running cleanup for permanently deleted users...');
  
  try {
    // Get users marked for deletion older than 30 days
    const usersToDelete = await UserModel.getUsersToPermanentlyDelete();
    
    if (usersToDelete.length === 0) {
      console.log('✅ No users to permanently delete.');
      return;
    }
    
    console.log(`📋 Found ${usersToDelete.length} users to permanently delete.`);
    
    for (const user of usersToDelete) {
      console.log(`🗑️ Permanently deleting user: ${user.email} (ID: ${user.id})`);
      await UserModel.permanentlyDeleteUser(user.id);
    }
    
    console.log(`✅ Successfully deleted ${usersToDelete.length} users.`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await db.end();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupDeletedUsers();
}

module.exports = { cleanupDeletedUsers };