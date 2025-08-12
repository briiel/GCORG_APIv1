const db = require('../config/db');
const QRCode = require('qrcode');
const { v2: cloudinary } = require('cloudinary');
const { sendRegistrationEmail } = require('../utils/mailer');

// Configure Cloudinary (it will automatically use CLOUDINARY_URL from env)
cloudinary.config({
    secure: true
});

const registerParticipant = async ({
    event_id,
    student_id,
    proof_of_payment = null,
    proof_of_payment_public_id = null
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

        // 3. Insert into event_registrations with proof of payment
        const [regResult] = await conn.query(
            `INSERT INTO event_registrations (event_id, student_id, proof_of_payment, proof_of_payment_public_id, qr_code)
             VALUES (?, ?, ?, ?, ?)`,
            [event_id, student_id, proof_of_payment, proof_of_payment_public_id, null]
        );
        const registration_id = regResult.insertId;

        if (!registration_id) {
            throw new Error('Failed to register for the event.');
        }

        // 4. Generate QR code and upload to Cloudinary
        const qrData = { registration_id, event_id, student_id };
        const qrString = JSON.stringify(qrData);

        // Generate QR code as buffer
        const qrBuffer = await QRCode.toBuffer(qrString, {
            type: 'png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Upload QR code to Cloudinary
        const qrFilename = `registration_${registration_id}`;
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    public_id: qrFilename,
                    folder: 'qr-codes', // Organize QR codes in a folder
                    format: 'png',
                    quality: 'auto'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(qrBuffer);
        });

        console.log('QR Code uploaded to Cloudinary:', uploadResult.secure_url);

        // 5. Update event_registrations with Cloudinary URL and public_id
        await conn.query(
            `UPDATE event_registrations SET qr_code = ?, qr_code_public_id = ? WHERE id = ?`,
            [uploadResult.secure_url, uploadResult.public_id, registration_id]
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
            try {
                await sendRegistrationEmail(
                    studentEmail,
                    'Event Registration Successful',
                    `You have successfully registered for the event "${eventTitle}".`,
                    uploadResult.secure_url // Pass QR code URL for email attachment
                );
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Don't throw error here, registration was successful
            }
        }

        await conn.commit();
        return {
            success: true,
            registration_id,
            qr_code: uploadResult.secure_url,
            qr_code_public_id: uploadResult.public_id,
            proof_of_payment: proof_of_payment,
            proof_of_payment_public_id: proof_of_payment_public_id
        };
    } catch (err) {
        await conn.rollback();
        console.error('Registration error:', err);
        throw err;
    } finally {
        conn.release();
    }
};

module.exports = { registerParticipant };