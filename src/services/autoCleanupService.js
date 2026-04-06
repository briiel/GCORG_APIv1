// Auto-cleanup cron service: permanently deletes archived items older than 30 days (runs daily at 2AM Asia/Manila)

const cron = require('node-cron');
const archiveModel = require('../models/archiveModel');

let cleanupJob = null;

// Schedule daily cleanup at 2:00 AM
const startAutoCleanup = () => {
    cleanupJob = cron.schedule('0 2 * * *', async () => {
        console.log('[Auto-Cleanup] Starting scheduled cleanup of expired archived items...');
        try {
            const deleted = await archiveModel.autoDeleteExpiredItems();
            console.log('[Auto-Cleanup] Cleanup completed successfully:');
            console.log(`  - Admins deleted: ${deleted.admins}`);
            console.log(`  - Organizations deleted: ${deleted.organizations}`);
            console.log(`  - Members deleted: ${deleted.members}`);
            if (deleted.admins > 0 || deleted.organizations > 0 || deleted.members > 0) {
                console.log('[Auto-Cleanup] Total items permanently deleted:',
                    deleted.admins + deleted.organizations + deleted.members);
            } else {
                console.log('[Auto-Cleanup] No expired items found.');
            }
        } catch (error) {
            console.error('[Auto-Cleanup] Error during cleanup:', error);
        }
    }, { scheduled: true, timezone: "Asia/Manila" });

    console.log('[Auto-Cleanup] Service started. Will run daily at 2:00 AM (Asia/Manila)');
};

// Stop the scheduled cleanup job
const stopAutoCleanup = () => {
    if (cleanupJob) {
        cleanupJob.stop();
        console.log('[Auto-Cleanup] Service stopped.');
    }
};

// Trigger cleanup immediately (for manual invocation or testing)
const runCleanupNow = async () => {
    console.log('[Auto-Cleanup] Running cleanup immediately...');
    try {
        const deleted = await archiveModel.autoDeleteExpiredItems();
        console.log('[Auto-Cleanup] Cleanup completed:');
        console.log(`  - Admins deleted: ${deleted.admins}`);
        console.log(`  - Organizations deleted: ${deleted.organizations}`);
        console.log(`  - Members deleted: ${deleted.members}`);
        return deleted;
    } catch (error) {
        console.error('[Auto-Cleanup] Error during cleanup:', error);
        throw error;
    }
};

module.exports = { startAutoCleanup, stopAutoCleanup, runCleanupNow };
