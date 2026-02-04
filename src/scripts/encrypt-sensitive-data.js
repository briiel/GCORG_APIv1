/**
 * Database Migration Script: Encrypt Sensitive Data
 * 
 * This script encrypts existing sensitive data in the database:
 * - Student emails
 * - Student IDs
 * - Organization emails
 * 
 * Usage:
 * node src/scripts/encrypt-sensitive-data.js [--dry-run]
 */

const db = require('../config/db');
const { encryptData } = require('../utils/encryption');

// Track migration status
const MIGRATION_NAME = 'encrypt_sensitive_data_v1';

async function checkMigrationStatus() {
    try {
        // Create migrations table if it doesn't exist
        await db.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const [rows] = await db.query(
            'SELECT * FROM migrations WHERE name = ?',
            [MIGRATION_NAME]
        );

        return rows.length > 0;
    } catch (error) {
        console.error('Error checking migration status:', error);
        throw error;
    }
}

async function markMigrationComplete() {
    try {
        await db.query(
            'INSERT INTO migrations (name) VALUES (?)',
            [MIGRATION_NAME]
        );
        console.log('✅ Migration marked as complete');
    } catch (error) {
        console.error('Error marking migration complete:', error);
        throw error;
    }
}

async function encryptStudentData(dryRun = false) {
    console.log('\n📋 Processing students table...');

    try {
        // Fetch all students
        const [students] = await db.query('SELECT id, email FROM students');
        console.log(`Found ${students.length} students to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const student of students) {
            try {
                // Check if already encrypted (encrypted data has format: iv:authTag:data)
                if (student.email && student.email.includes(':') && student.email.split(':').length === 3) {
                    console.log(`⏭️  Student ${student.id}: Already encrypted, skipping`);
                    continue;
                }

                const encryptedEmail = student.email ? encryptData(student.email) : null;
                const encryptedId = encryptData(student.id);

                if (dryRun) {
                    console.log(`[DRY RUN] Would encrypt student ${student.id}:`);
                    console.log(`  Email: ${student.email} -> ${encryptedEmail?.substring(0, 30)}...`);
                    console.log(`  ID: ${student.id} -> ${encryptedId?.substring(0, 30)}...`);
                } else {
                    // Update with encrypted data
                    await db.query(
                        'UPDATE students SET email = ?, id = ? WHERE id = ?',
                        [encryptedEmail, encryptedId, student.id]
                    );
                    console.log(`✅ Encrypted student ${student.id}`);
                }

                successCount++;
            } catch (error) {
                console.error(`❌ Error encrypting student ${student.id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n📊 Students Summary: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error processing students:', error);
        throw error;
    }
}

async function encryptOrganizationData(dryRun = false) {
    console.log('\n📋 Processing student_organizations table...');

    try {
        // Fetch all organizations
        const [orgs] = await db.query('SELECT id, email FROM student_organizations');
        console.log(`Found ${orgs.length} organizations to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const org of orgs) {
            try {
                // Check if already encrypted
                if (org.email && org.email.includes(':') && org.email.split(':').length === 3) {
                    console.log(`⏭️  Organization ${org.id}: Already encrypted, skipping`);
                    continue;
                }

                const encryptedEmail = org.email ? encryptData(org.email) : null;

                if (dryRun) {
                    console.log(`[DRY RUN] Would encrypt organization ${org.id}:`);
                    console.log(`  Email: ${org.email} -> ${encryptedEmail?.substring(0, 30)}...`);
                } else {
                    // Update with encrypted data
                    await db.query(
                        'UPDATE student_organizations SET email = ? WHERE id = ?',
                        [encryptedEmail, org.id]
                    );
                    console.log(`✅ Encrypted organization ${org.id}`);
                }

                successCount++;
            } catch (error) {
                console.error(`❌ Error encrypting organization ${org.id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n📊 Organizations Summary: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error processing organizations:', error);
        throw error;
    }
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    console.log('🔐 Starting Sensitive Data Encryption Migration');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (data will be encrypted)'}`);
    console.log('='.repeat(60));

    try {
        // Check if migration already ran
        const alreadyRan = await checkMigrationStatus();
        if (alreadyRan && !dryRun) {
            console.log('⚠️  Migration already completed. Skipping.');
            console.log('To re-run, delete the migration record from the migrations table.');
            process.exit(0);
        }

        // Encrypt student data
        const studentResults = await encryptStudentData(dryRun);

        // Encrypt organization data
        const orgResults = await encryptOrganizationData(dryRun);

        // Mark migration as complete
        if (!dryRun) {
            await markMigrationComplete();
        }

        console.log('\n' + '='.repeat(60));
        console.log('✅ Migration completed successfully!');
        console.log(`Total records processed: ${studentResults.successCount + orgResults.successCount}`);
        console.log(`Total errors: ${studentResults.errorCount + orgResults.errorCount}`);

        if (dryRun) {
            console.log('\n⚠️  This was a DRY RUN. No data was modified.');
            console.log('Run without --dry-run to apply changes.');
        }

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        await db.end();
    }
}

// Run migration
main();
