const db = require('../config/db');

/**
 * Evaluation Model
 * Manages participant evaluations for events
 */

// Create a new evaluation for an event
async function createEvaluation({ event_id, student_id, responses }) {
  const [result] = await db.query(
    `INSERT INTO evaluations (event_id, student_id, responses) 
     VALUES (?, ?, ?)`,
    [event_id, student_id, JSON.stringify(responses)]
  );
  
  // Also update attendance_records to mark evaluation as submitted
  await db.query(
    `UPDATE attendance_records 
     SET evaluation_submitted = 1, evaluation_submitted_at = UTC_TIMESTAMP() 
     WHERE event_id = ? AND student_id = ?`,
    [event_id, student_id]
  );
  
  return result.insertId;
}

// Get evaluation by student and event
async function getEvaluationByStudentAndEvent(event_id, student_id) {
  const [rows] = await db.query(
    `SELECT id, event_id, student_id, responses, submitted_at 
     FROM evaluations 
     WHERE event_id = ? AND student_id = ? 
     LIMIT 1`,
    [event_id, student_id]
  );
  
  if (rows.length > 0) {
    // Parse JSON responses
    return {
      ...rows[0],
      responses: typeof rows[0].responses === 'string' 
        ? JSON.parse(rows[0].responses) 
        : rows[0].responses
    };
  }
  
  return null;
}

// Check if student has submitted evaluation for an event
async function hasSubmittedEvaluation(event_id, student_id) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as count 
     FROM evaluations 
     WHERE event_id = ? AND student_id = ? 
     LIMIT 1`,
    [event_id, student_id]
  );
  
  return rows[0].count > 0;
}

// Get all evaluations for an event (for organizers/admins)
async function getEvaluationsByEvent(event_id) {
  // Use LEFT JOIN so evaluations are returned even if the student record is missing
  // (avoids losing rows when student data is absent). Fallback student fields
  // to empty strings to keep the UI rendering predictable.
  const [rows] = await db.query(
    `SELECT e.id, e.event_id, e.student_id, e.responses, e.submitted_at,
            IFNULL(s.first_name, '') AS first_name,
            IFNULL(s.last_name, '') AS last_name,
            IFNULL(s.middle_initial, '') AS middle_initial,
            IFNULL(s.suffix, '') AS suffix,
            IFNULL(s.department, '') AS department,
            IFNULL(s.program, '') AS program
     FROM evaluations e
     LEFT JOIN students s ON e.student_id = s.id
     WHERE e.event_id = ?
     ORDER BY e.submitted_at DESC`,
    [event_id]
  );

  return rows.map(row => ({
    ...row,
    // keep responses as object when possible
    responses: typeof row.responses === 'string'
      ? JSON.parse(row.responses)
      : row.responses
  }));
}

// Get evaluation statistics for an event
async function getEvaluationStats(event_id) {
  const [stats] = await db.query(
    `SELECT 
       COUNT(*) as total_evaluations,
       COUNT(DISTINCT student_id) as unique_participants
     FROM evaluations 
     WHERE event_id = ?`,
    [event_id]
  );
  
  return stats[0];
}

// Return raw evaluation rows (no joins) — helpful for debugging or admin views
async function getRawEvaluationsByEvent(event_id) {
  const [rows] = await db.query(
    `SELECT id, event_id, student_id, responses, submitted_at
     FROM evaluations
     WHERE event_id = ?
     ORDER BY submitted_at DESC`,
    [event_id]
  );

  return rows.map(row => ({
    ...row,
    responses: typeof row.responses === 'string' ? JSON.parse(row.responses) : row.responses
  }));
}

module.exports = {
  createEvaluation,
  getEvaluationByStudentAndEvent,
  hasSubmittedEvaluation,
  getEvaluationsByEvent,
  getEvaluationStats,
  getRawEvaluationsByEvent
};
