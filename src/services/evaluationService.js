const evaluationModel = require('../models/evaluationModel');
const db = require('../config/db');
const { generateCertificate } = require('../utils/certificateGenerator');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure Cloudinary (it will automatically use CLOUDINARY_URL from env)
cloudinary.config({
  secure: true
});

/**
 * Evaluation Service
 * Business logic for managing event evaluations
 */

// Submit an evaluation for an event
async function submitEvaluation({ event_id, student_id, responses }) {
  // Validate that the student attended the event
  const [attendance] = await db.query(
    `SELECT id FROM attendance_records 
     WHERE event_id = ? AND student_id = ? 
     LIMIT 1`,
    [event_id, student_id]
  );

  if (attendance.length === 0) {
    throw new Error('You must attend the event before submitting an evaluation.');
  }
  
  // Check if already submitted
  const hasSubmitted = await evaluationModel.hasSubmittedEvaluation(event_id, student_id);
  if (hasSubmitted) {
    throw new Error('You have already submitted an evaluation for this event.');
  }
  
  // Validate event exists and get event details (including creator info)
  const [event] = await db.query(
    `SELECT event_id, title as event_title, location as event_location, start_date, end_date,
            created_by_osws_id, created_by_org_id
     FROM created_events 
     WHERE event_id = ? AND deleted_at IS NULL 
     LIMIT 1`,
    [event_id]
  );
  
  if (event.length === 0) {
    throw new Error('Event not found.');
  }
  
  const eventData = event[0];
  const isOswsEvent = !!eventData.created_by_osws_id;
  
  // Get student name
  const [student] = await db.query(
    `SELECT CONCAT(first_name, ' ', last_name) as student_name 
     FROM students 
     WHERE id = ? 
     LIMIT 1`,
    [student_id]
  );
  
  if (student.length === 0) {
    throw new Error('Student not found.');
  }
  
  const studentName = student[0].student_name;
  
  // Create the evaluation
  const evaluationId = await evaluationModel.createEvaluation({
    event_id,
    student_id,
    responses
  });
  
  // Generate certificate immediately ONLY for OSWS events
  // Organization events require manual certificate generation/request after evaluation
  let certificateUrl = null;
  
  if (isOswsEvent) {
    try {
      // Create temporary file
      const tempDir = os.tmpdir();
      const certFilename = `certificate_${event_id}_${student_id}.png`;
      const tempCertPath = path.join(tempDir, certFilename);
    
    // Generate certificate
    await generateCertificate({
      studentName: studentName,
      eventTitle: eventData.event_title,
      eventLocation: eventData.event_location,
      eventStartDate: eventData.start_date,
      eventEndDate: eventData.end_date,
      certificatePath: tempCertPath
    });
    
    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempCertPath, {
      folder: 'certificates',
      public_id: `cert_${event_id}_${student_id}`,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      format: 'png'
    });
    
    certificateUrl = uploadResult.secure_url;
    
    // Save certificate to database
    await db.query(
      `INSERT INTO certificates (student_id, event_id, certificate_url, certificate_public_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       certificate_url = VALUES(certificate_url),
       certificate_public_id = VALUES(certificate_public_id)`,
      [student_id, event_id, uploadResult.secure_url, uploadResult.public_id]
    );
    
      // Clean up temporary file
      try {
        if (fs.existsSync(tempCertPath)) {
          fs.unlinkSync(tempCertPath);
        }
      } catch (cleanupError) {
        console.warn(`Failed to cleanup temp file: ${tempCertPath}`, cleanupError);
      }
    } catch (certError) {
      console.error('Failed to generate certificate:', certError);
      console.error('Certificate error stack:', certError.stack);
      // Throw error so the user knows certificate generation failed
      throw new Error(`Evaluation submitted but certificate generation failed: ${certError.message}`);
    }
  }
  
  // Return appropriate message based on event type
  const message = isOswsEvent 
    ? 'Evaluation submitted successfully. Your certificate is ready for download!'
    : 'Evaluation submitted successfully. You can now request your certificate from the organizer.';
  
  return {
    success: true,
    evaluation_id: evaluationId,
    certificate_url: certificateUrl,
    message: message,
    is_osws_event: isOswsEvent
  };
}

// Get student's evaluation status for an event
async function getEvaluationStatus(event_id, student_id) {
  // Check attendance first
  const [attendance] = await db.query(
    `SELECT id, evaluation_submitted, evaluation_submitted_at 
     FROM attendance_records 
     WHERE event_id = ? AND student_id = ? 
     LIMIT 1`,
    [event_id, student_id]
  );
  
  const hasAttended = attendance.length > 0;
  const hasEvaluated = hasAttended && attendance[0].evaluation_submitted === 1;
  
  return {
    has_attended: hasAttended,
    has_evaluated: hasEvaluated,
    evaluation_submitted_at: hasAttended ? attendance[0].evaluation_submitted_at : null,
    can_download_certificate: hasAttended && hasEvaluated
  };
}

// Get student's submitted evaluation
async function getStudentEvaluation(event_id, student_id) {
  const evaluation = await evaluationModel.getEvaluationByStudentAndEvent(event_id, student_id);
  
  if (!evaluation) {
    throw new Error('No evaluation found for this event.');
  }
  
  return evaluation;
}

// Get all evaluations for an event (organizers/admins only)
async function getEventEvaluations(event_id, user) {
  // Verify user has access to this event
  const [event] = await db.query(
    `SELECT created_by_org_id, created_by_osws_id 
     FROM created_events 
     WHERE event_id = ? 
     LIMIT 1`,
    [event_id]
  );
  
  if (event.length === 0) {
    throw new Error('Event not found.');
  }
  
  const eventData = event[0];
  
  // Check authorization: support normalized roles array (orgofficer, oswsadmin)
  const userRoles = Array.isArray(user.roles) ? user.roles : [];
  let isAuthorized = false;

  if (userRoles.includes('orgofficer')) {
    const orgId = user.organization && user.organization.org_id ? user.organization.org_id : null;
    // Compare as strings to avoid type-mismatch (token may store strings)
    if (orgId !== null && String(eventData.created_by_org_id) === String(orgId)) {
      isAuthorized = true;
    }
  }

  if (userRoles.includes('oswsadmin')) {
    const adminId = user.legacyId || user.id || null;
    if (adminId !== null && String(eventData.created_by_osws_id) === String(adminId)) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    throw new Error('You are not authorized to view evaluations for this event.');
  }
  
  const evaluations = await evaluationModel.getEvaluationsByEvent(event_id);
  const stats = await evaluationModel.getEvaluationStats(event_id);
  
  return {
    evaluations,
    stats
  };
}

module.exports = {
  submitEvaluation,
  getEvaluationStatus,
  getStudentEvaluation,
  getEventEvaluations
};

// Expose raw evaluations helper for debug endpoint
module.exports.getRawEvaluations = async (event_id) => {
  return await evaluationModel.getRawEvaluationsByEvent(event_id);
};
