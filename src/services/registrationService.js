const db = require('../config/db');
const QRCode = require('qrcode');
const { v2: cloudinary } = require('cloudinary');
const notificationService = require('./notificationService');

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
        // Allow re-registration when the latest record is rejected; block when pending/approved exists
        const [existingRows] = await conn.query(
            `SELECT id, status, qr_code, qr_code_public_id, proof_of_payment, proof_of_payment_public_id
             FROM event_registrations
             WHERE event_id = ? AND student_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [event_id, student_id]
        );

        // Determine if event is paid to set initial status
        let isPaid = 0;
        try {
            const [evRows] = await conn.query('SELECT is_paid, title FROM created_events WHERE event_id = ? LIMIT 1', [event_id]);
            isPaid = Number(evRows?.[0]?.is_paid || 0);
        } catch (_) {}
        const initialStatus = isPaid ? 'pending' : 'approved';

        // If the latest registration was rejected, update that record instead of inserting a new one
        if (existingRows.length > 0) {
            const latest = existingRows[0];
            const latestStatus = String(latest.status || '').toLowerCase();
            if (latestStatus === 'approved' || latestStatus === 'pending') {
                throw new Error('You have already registered for this event.');
            }
            if (latestStatus === 'rejected') {
                // Update existing row: reset status, approval metadata, and optionally proof of payment
                await conn.query(
                    `UPDATE event_registrations
                     SET status = ?,
                         approved_at = NULL,
                         approved_by_org_id = NULL,
                         approved_by_osws_id = NULL,
                         proof_of_payment = COALESCE(?, proof_of_payment),
                         proof_of_payment_public_id = COALESCE(?, proof_of_payment_public_id)
                     WHERE id = ?`,
                    [initialStatus, proof_of_payment, proof_of_payment_public_id, latest.id]
                );

                // Ensure QR exists; generate/upload only if missing
                let qrUrl = latest.qr_code;
                let qrPublicId = latest.qr_code_public_id;
                if (!qrUrl || !qrPublicId) {
                    const qrString = String(student_id);
                    const qrBuffer = await QRCode.toBuffer(qrString, {
                        type: 'png',
                        quality: 0.92,
                        margin: 1,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    });
                    const qrFilename = `registration_${latest.id}`;
                    // Try to upload to Cloudinary; if not configured or upload fails, fall back to data URL
                    try {
                        const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
                        if (cloudinaryConfigured) {
                            const uploadResult2 = await new Promise((resolve, reject) => {
                                cloudinary.uploader.upload_stream(
                                    { resource_type: 'image', public_id: qrFilename, folder: 'qr-codes', format: 'png', quality: 'auto' },
                                    (error, result) => error ? reject(error) : resolve(result)
                                ).end(qrBuffer);
                            });
                            qrUrl = uploadResult2.secure_url;
                            qrPublicId = uploadResult2.public_id;
                        } else {
                            qrUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
                            qrPublicId = null;
                        }
                    } catch (uerr) {
                        // Fallback to base64 data URL when Cloudinary fails unexpectedly
                        qrUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
                        qrPublicId = null;
                    }
                    await conn.query(
                        `UPDATE event_registrations SET qr_code = ?, qr_code_public_id = ? WHERE id = ?`,
                        [qrUrl, qrPublicId, latest.id]
                    );
                }

                // Notifications
                try {
                    const [eventRows] = await conn.query(
                        `SELECT title FROM created_events WHERE event_id = ? LIMIT 1`,
                        [event_id]
                    );
                    const eventTitle2 = eventRows?.[0]?.title;
                    if (eventTitle2) {
                        const msg2 = initialStatus === 'approved'
                            ? `You have successfully re-registered for "${eventTitle2}". Your QR code is ready.`
                            : `Your registration for "${eventTitle2}" has been resubmitted and is pending organizer approval.`;
                        await notificationService.createNotification({ user_id: String(student_id), event_id, message: msg2 });
                    }
                } catch (_) {}

                await conn.commit();
                return {
                    success: true,
                    registration_id: latest.id,
                    qr_code: qrUrl || null,
                    qr_code_public_id: qrPublicId || null,
                    proof_of_payment: proof_of_payment || latest.proof_of_payment || null,
                    proof_of_payment_public_id: proof_of_payment_public_id || latest.proof_of_payment_public_id || null
                };
            }
        }

        // 3. Insert into event_registrations with proof of payment and initial status
        const [regResult] = await conn.query(
            `INSERT INTO event_registrations (event_id, student_id, proof_of_payment, proof_of_payment_public_id, qr_code, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [event_id, student_id, proof_of_payment, proof_of_payment_public_id, null, initialStatus]
        );
        const registration_id = regResult.insertId;

        if (!registration_id) {
            throw new Error('Failed to register for the event.');
        }

    // 4. Generate QR code and upload to Cloudinary
    // Requirement: QR content should contain ONLY the student_id
    const qrString = String(student_id);

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
        // Upload QR code to Cloudinary if configured; otherwise fall back to data URL
        let uploadResult = null;
        let finalQrUrl = null;
        let finalQrPublicId = null;
        try {
            const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);
            if (cloudinaryConfigured) {
                uploadResult = await new Promise((resolve, reject) => {
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
                finalQrUrl = uploadResult.secure_url;
                finalQrPublicId = uploadResult.public_id;
            } else {
                finalQrUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
                finalQrPublicId = null;
            }
        } catch (uerr) {
            console.warn('QR upload failed, falling back to data URL:', uerr && uerr.message ? uerr.message : uerr);
            finalQrUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;
            finalQrPublicId = null;
        }

        // 5. Update event_registrations with QR info (either Cloudinary URL or data URL)
        await conn.query(
            `UPDATE event_registrations SET qr_code = ?, qr_code_public_id = ? WHERE id = ?`,
            [finalQrUrl, finalQrPublicId, registration_id]
        );

        // Fetch student info for notification
        const [studentRows] = await conn.query(
            `SELECT id, email, first_name, last_name FROM students WHERE id = ?`,
            [student_id]
        );
        const student = studentRows[0] || {};
        const studentIdStr = String(student.id);

        // Fetch event details for notification
        const [eventRows] = await conn.query(
            `SELECT title, location, start_date, start_time, end_date, end_time FROM created_events WHERE event_id = ?`,
            [event_id]
        );
        const event = eventRows[0] || {};
        const eventTitle = event.title;
        // Create in-app notification for the student
        if (studentIdStr && eventTitle) {
            try {
                const msg = initialStatus === 'approved'
                    ? `You have successfully registered for "${eventTitle}". Your QR code is ready.`
                    : `Your registration for "${eventTitle}" has been submitted and is pending organizer approval.`;
                await notificationService.createNotification({ user_id: studentIdStr, event_id, message: msg });
            } catch (nerr) {
                console.warn('Notification create failed (registration):', nerr?.message || nerr);
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