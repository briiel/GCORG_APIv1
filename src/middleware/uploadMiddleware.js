const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({ secure: true });

// Use memory storage — files are handled in-memory before uploading to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
        }
    }
});

// Converts uploaded image to WebP and uploads to Cloudinary
const convertToWebpAndUpload = async (req, res, next) => {
    if (!req.file) return next();

    try {
        const webpBuffer = await sharp(req.file.buffer).webp({ quality: 80 }).toBuffer();

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // Route to correct folder based on field name
        let folder, filenamePrefix;
        if (req.file.fieldname === 'proof_of_payment') {
            folder = 'proof-of-payments';
            filenamePrefix = 'payment-proof';
        } else {
            folder = 'event-posters';
            filenamePrefix = 'event-poster';
        }

        const filename = `${filenamePrefix}-${uniqueSuffix}`;
        const cloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);

        if (cloudinaryConfigured) {
            const uploadResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { resource_type: 'image', public_id: filename, folder, format: 'webp', quality: 'auto', fetch_format: 'auto' },
                    (error, result) => { if (error) reject(error); else resolve(result); }
                ).end(webpBuffer);
            });

            req.file.cloudinaryUrl = uploadResult.secure_url;
            req.file.cloudinaryPublicId = uploadResult.public_id;
            req.file.path = uploadResult.secure_url;
        } else {
            // Dev fallback: store a base64 data URL instead of a Cloudinary URL
            const dataUrl = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
            req.file.cloudinaryUrl = dataUrl;
            req.file.cloudinaryPublicId = null;
            req.file.path = dataUrl;
        }

        next();
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        next(error);
    }
};

module.exports = { upload, convertToWebpAndUpload };