const db = require('../config/db');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { sendRegistrationEmail } = require('../utils/mailer');

const registerParticipant = async ({
    event_id,
    student_id,
    proof_of_payment = null,
    first_name,
    last_name,
    suffix,
    domain_email,
    department,
    program
}) => {
    // Convert all string fields to uppercase (except emails if you want to keep them case-insensitive)
    first_name = first_name ? first_name.toUpperCase() : '';
    last_name = last_name ? last_name.toUpperCase() : '';
    suffix = suffix ? suffix.toUpperCase() : '';
    department = department ? department.toUpperCase() : '';
    program = program ? program.toUpperCase() : '';
    // Optionally: domain_email = domain_email ? domain_email.toUpperCase() : '';

    // Start transaction
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // Check if already registered
        const [existing] = await conn.query(
            `SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?`,
            [event_id, student_id]
        );
        if (existing.length > 0) {
            throw new Error('You have already registered for this event.');
        }

        // 1. Insert into event_registrations
        const [regResult] = await conn.query(
            `INSERT INTO event_registrations (event_id, student_id, proof_of_payment, qr_code)
             VALUES (?, ?, ?, ?)`,
            [event_id, student_id, proof_of_payment, null]
        );
        const registration_id = regResult.insertId;

        // 2. Prepare QR code data
        const qrData = {
            registration_id,
            event_id,
            student_id
        };
        console.log('QR DATA:', qrData); // For debugging
        const qrString = JSON.stringify(qrData);

        // 3. Generate QR code and save as PNG
        const qrDir = path.join(__dirname, '../../uploads/qrcodes');
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
        const qrPath = path.join(qrDir, `registration_${registration_id}.png`);
        await QRCode.toFile(qrPath, qrString);

        // 4. Update event_registrations with qr_code path
        const qrFilename = `registration_${registration_id}.png`;
        await conn.query(
            `UPDATE event_registrations SET qr_code = ? WHERE id = ?`,
            [qrFilename, registration_id]
        );

        // 5. Insert into registration_details
        await conn.query(
            `INSERT INTO registration_details
            (registration_id, first_name, last_name, suffix, domain_email, department, program)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [registration_id, first_name, last_name, suffix, domain_email, department, program]
        );

        // Fetch event title
        const [eventRows] = await conn.query(
            `SELECT title FROM created_events WHERE event_id = ?`,
            [event_id]
        );
        const eventTitle = eventRows.length > 0 ? eventRows[0].title : `Event ID ${event_id}`;

        // After successful registration:
        await sendRegistrationEmail(
            domain_email,
            'Event Registration Confirmation',
            `Hello ${first_name} ${last_name},\n\nYou have successfully registered for "${eventTitle}".\n\nThank you!`
        );

        await conn.commit();
        return { success: true, registration_id, qr_code: qrFilename };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

module.exports = { registerParticipant };