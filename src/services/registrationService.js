const db = require('../config/db');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { sendRegistrationEmail } = require('../utils/mailer');

const registerParticipant = async ({
    event_id,
    student_id,
    proof_of_payment = null
}) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Confirm student exists
        const [students] = await conn.query(
            `SELECT * FROM students WHERE id = ?`,
            [student_id]
        );
        if (students.length === 0) {
            throw new Error('Student not found.');
        }

        // 2. Check if already registered
        const [existing] = await conn.query(
            `SELECT id FROM event_registrations WHERE event_id = ? AND student_id = ?`,
            [event_id, student_id]
        );
        if (existing.length > 0) {
            throw new Error('You have already registered for this event.');
        }

        // 3. Insert into event_registrations
        const [regResult] = await conn.query(
            `INSERT INTO event_registrations (event_id, student_id, proof_of_payment, qr_code)
             VALUES (?, ?, ?, ?)`,
            [event_id, student_id, proof_of_payment, null]
        );
        const registration_id = regResult.insertId;

        if (!registration_id) {
            throw new Error('Failed to register for the event.');
        }

        // 4. Generate QR code and save as PNG
        const qrData = { registration_id, event_id, student_id };
        const qrString = JSON.stringify(qrData);
        const qrDir = path.join(__dirname, '../../uploads/qrcodes');
        if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });
        const qrFilename = `registration_${registration_id}.png`;
        const qrPath = path.join(qrDir, qrFilename);
        await QRCode.toFile(qrPath, qrString);

        // 5. Update event_registrations with qr_code path
        await conn.query(
            `UPDATE event_registrations SET qr_code = ? WHERE id = ?`,
            [qrFilename, registration_id]
        );

        // Fetch student email for notification
        const [studentRows] = await conn.query(
            `SELECT email FROM students WHERE id = ?`,
            [student_id]
        );
        const studentEmail = studentRows[0]?.email;

        // Fetch event title for email
        const [eventRows] = await conn.query(
            `SELECT title FROM created_events WHERE event_id = ?`,
            [event_id]
        );
        const eventTitle = eventRows[0]?.title;

        if (studentEmail && eventTitle) {
            await sendRegistrationEmail(
                studentEmail,
                'Event Registration Successful',
                `You have successfully registered for the event "${eventTitle}".`
            );
        }

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