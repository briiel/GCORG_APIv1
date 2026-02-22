const db = require('../config/db');

/**
 * Certificate Model
 * Provides CRUD operations for the `certificates` table.
 * The certificates table stores generated/issued certificates for event participants.
 *
 * Schema:
 *   id INT AUTO_INCREMENT PK
 *   student_id VARCHAR(20)
 *   event_id INT
 *   certificate_url TEXT
 *   certificate_public_id VARCHAR(255)
 *   generated_at DATETIME DEFAULT current_timestamp()
 *   deleted_at DATETIME
 *   deleted_by INT
 */

/**
 * Get all non-deleted certificates for a specific student.
 * @param {string} studentId
 * @returns {Promise<Array>}
 */
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

/**
 * Get all non-deleted certificates for a specific event.
 * @param {number} eventId
 * @returns {Promise<Array>}
 */
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

/**
 * Get an existing certificate for a student+event pair (or null if not found).
 * @param {number} eventId
 * @param {string} studentId
 * @returns {Promise<Object|null>}
 */
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

/**
 * Save (insert) a new certificate record.
 * @param {{ student_id: string, event_id: number, certificate_url: string, certificate_public_id: string }} certData
 * @returns {Promise<number>} insertId
 */
const saveCertificate = async ({ student_id, event_id, certificate_url, certificate_public_id }) => {
    const [result] = await db.query(
        `INSERT INTO certificates (student_id, event_id, certificate_url, certificate_public_id)
         VALUES (?, ?, ?, ?)`,
        [student_id, event_id, certificate_url || null, certificate_public_id || null]
    );
    return result.insertId;
};

/**
 * Soft-delete a certificate record.
 * @param {number} certId
 * @param {number|null} deletedBy  - admin/officer ID performing the delete
 * @returns {Promise<boolean>}
 */
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
