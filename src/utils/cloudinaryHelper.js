const cloudinary = require('../config/cloudinary');
const fs = require('fs');
const { uploadQrToCloudinary } = require('../utils/cloudinaryHelper');

async function uploadPdfToCloudinary(localPath, publicId) {
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'raw',
    folder: 'gcorg_certificates',
    public_id,
    format: 'pdf'
  });
  fs.unlinkSync(localPath); // Remove local file after upload
  return result.secure_url;
}

// Add this function for QR codes
async function uploadQrToCloudinary(localPath, publicId) {
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'image',
    folder: 'gcorg_qrcodes',
    public_id,
    format: 'png'
  });
  fs.unlinkSync(localPath); // Remove local file after upload
  return result.secure_url;
}

module.exports = { uploadPdfToCloudinary, uploadQrToCloudinary };

// After generating the QR code and saving it as a PNG:
const qrFilename = `qrcode_${eventId}_${studentId}.png`;
const qrPath = path.join(qrDir, qrFilename);

// Upload to Cloudinary
const qrUrl = await uploadQrToCloudinary(qrPath, qrFilename);

// Save qrUrl to your database instead of the local file path
await db.query(
  'UPDATE event_registrations SET qr_code_url = ? WHERE event_id = ? AND student_id = ?',
  [qrUrl, eventId, studentId]
);