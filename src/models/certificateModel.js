// CRUD operations for the `certificates` table (stores issued e-certificates per student/event)

const db = require('../config/db');

// Fetch all non-deleted certificates for a student, joined with event and org info
const getCertificatesByStudent = async (studentId) => {
    const [rows] = await db.query(
        `SELECT c.id, c.student_id, c.event_id, c.certificate_url,
                c.certificate_public_id, c.generated_at,
                ce.title AS event_title, ce.start_date, ce.end_date,
                ce.location, org.org_name, osws.name AS osws_name
         FROM certificates c
         JOIN created_events ce ON c.event_id = ce.event_id
         LEFT JOIN student_organizations org ON ce.created_by_org_id = org.id
         LEFT JOIN osws_admins osws ON ce.created_by_osws_id = osws.id
         WHERE c.student_id = ? AND c.deleted_at IS NULL
         ORDER BY c.generated_at DESC`,
        [studentId]
    );
    return rows;
};

// Fetch all non-deleted certificates for an event, joined with student info
const getCertificatesByEvent = async (eventId) => {
    const [rows] = await db.query(
        `SELECT c.id, c.student_id, c.event_id, c.certificate_url,
                c.certificate_public_id, c.generated_at,
                s.first_name, s.last_name, s.middle_initial, s.suffix,
                s.department, s.program, COALESCE(s.year_level, 4) AS year_level
         FROM certificates c
         JOIN students s ON c.student_id = s.id
         WHERE c.event_id = ? AND c.deleted_at IS NULL
         ORDER BY c.generated_at DESC`,
        [eventId]
    );
    return rows;
};

// Fetch a single non-deleted certificate for a given student+event pair, or null
const getCertificateByEventAndStudent = async (eventId, studentId) => {
    const [rows] = await db.query(
        `SELECT id, student_id, event_id, certificate_url, certificate_public_id, generated_at
         FROM certificates
         WHERE event_id = ? AND student_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [eventId, studentId]
    );
    return rows[0] || null;
};

// Insert a new certificate record and return its insertId
const saveCertificate = async ({ student_id, event_id, certificate_url, certificate_public_id }) => {
    const [result] = await db.query(
        `INSERT INTO certificates (student_id, event_id, certificate_url, certificate_public_id)
         VALUES (?, ?, ?, ?)`,
        [student_id, event_id, certificate_url || null, certificate_public_id || null]
    );
    return result.insertId;
};

// Soft-delete a certificate by setting deleted_at/deleted_by; returns true if a row was affected
const softDeleteCertificate = async (certId, deletedBy = null) => {
    const [result] = await db.query(
        `UPDATE certificates SET deleted_at = UTC_TIMESTAMP(), deleted_by = ? WHERE id = ? AND deleted_at IS NULL`,
        [deletedBy, certId]
    );
    return result.affectedRows > 0;
};

module.exports = {
    getCertificatesByStudent,
    getCertificatesByEvent,
    getCertificateByEventAndStudent,
    saveCertificate,
    softDeleteCertificate
};
