// DB migration script: decrypts student/org/admin emails and IDs in-place

const db = require('../config/db');
const { decryptData } = require('../utils/encryption');

async function decryptStudentData() {
    console.log('\n[INFO] Processing students table...');
    try {
        const [students] = await db.query('SELECT id, email, first_name, last_name, middle_initial, suffix, department, program FROM students');
        console.log(`Found ${students.length} students to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const student of students) {
            try {
                let updated = false;
                let newEmail = student.email;
                let newFirstName = student.first_name;
                let newLastName = student.last_name;
                let newMiddleInitial = student.middle_initial;
                let newSuffix = student.suffix;
                let newDepartment = student.department;
                let newProgram = student.program;

                const tryDecrypt = (val) => {
                    if (val && typeof val === 'string' && val.includes(':') && val.split(':').length === 3) {
                        try { return decryptData(val); } catch (e) { return val; }
                    }
                    return val;
                };

                const decEmail = tryDecrypt(student.email);
                if (decEmail !== student.email) { newEmail = decEmail; updated = true; }

                const decFirstName = tryDecrypt(student.first_name);
                if (decFirstName !== student.first_name) { newFirstName = decFirstName; updated = true; }

                const decLastName = tryDecrypt(student.last_name);
                if (decLastName !== student.last_name) { newLastName = decLastName; updated = true; }

                if (updated) {
                    await db.query(
                        'UPDATE students SET email = ?, first_name = ?, last_name = ? WHERE id = ?',
                        [newEmail, newFirstName, newLastName, student.id]
                    );
                    console.log(`[OK] Decrypted student ${student.id}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`[ERROR] Error decrypting student ${student.id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n[INFO] Students Summary: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error processing students:', error);
        throw error;
    }
}

async function decryptOrganizationData() {
    console.log('\n[INFO] Processing student_organizations table...');
    try {
        const [orgs] = await db.query('SELECT id, email FROM student_organizations');
        console.log(`Found ${orgs.length} organizations to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const org of orgs) {
            try {
                if (org.email && org.email.includes(':') && org.email.split(':').length === 3) {
                    const decryptedEmail = decryptData(org.email);
                    await db.query('UPDATE student_organizations SET email = ? WHERE id = ?', [decryptedEmail, org.id]);
                    console.log(`[OK] Decrypted organization ${org.id}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`[ERROR] Error decrypting organization ${org.id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n[INFO] Organizations Summary: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error processing organizations:', error);
        throw error;
    }
}

async function decryptAdminData() {
    console.log('\n[INFO] Processing osws_admins table...');
    try {
        const [admins] = await db.query('SELECT id, email, name FROM osws_admins');
        console.log(`Found ${admins.length} admins to process`);

        let successCount = 0;
        let errorCount = 0;

        for (const admin of admins) {
            try {
                let updated = false;
                let newEmail = admin.email;
                let newName = admin.name;

                const tryDecrypt = (val) => {
                    if (val && typeof val === 'string' && val.includes(':') && val.split(':').length === 3) {
                        try { return decryptData(val); } catch (e) { return val; }
                    }
                    return val;
                };

                const decEmail = tryDecrypt(admin.email);
                if (decEmail !== admin.email) { newEmail = decEmail; updated = true; }

                const decName = tryDecrypt(admin.name);
                if (decName !== admin.name) { newName = decName; updated = true; }

                if (updated) {
                    await db.query('UPDATE osws_admins SET email = ?, name = ? WHERE id = ?', [newEmail, newName, admin.id]);
                    console.log(`[OK] Decrypted admin ${admin.id}`);
                    successCount++;
                }
            } catch (error) {
                console.error(`[ERROR] Error decrypting admin ${admin.id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n[INFO] Admins Summary: ${successCount} successful, ${errorCount} errors`);
        return { successCount, errorCount };
    } catch (error) {
        console.error('Error processing admins:', error);
        throw error;
    }
}

async function main() {
    console.log('[INFO] Starting Sensitive Data Decryption Migration');
    console.log('='.repeat(60));

    try {
        const studentResults = await decryptStudentData();
        const orgResults = await decryptOrganizationData();
        const adminResults = await decryptAdminData();

        console.log('\n' + '='.repeat(60));
        console.log('[OK] Decryption completed successfully!');
    } catch (error) {
        console.error('\n[ERROR] Migration failed:', error);
        process.exit(1);
    } finally {
        await db.end();
    }
}

main();
