const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { v2: cloudinary } = require('cloudinary');

// Configure Cloudinary (it will automatically use CLOUDINARY_URL from env)
cloudinary.config({
    secure: true
});

// Set up multer to use memory storage instead of disk storage
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
        }
    }
});

// Middleware to convert image to webp and upload to Cloudinary
const convertToWebpAndUpload = async (req, res, next) => {
    if (!req.file) return next();

    try {
        // Convert image to WebP using Sharp
        const webpBuffer = await sharp(req.file.buffer)
            .webp({ quality: 80 })
            .toBuffer();

        // Generate appropriate filename and folder based on the field name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // Determine folder and filename prefix based on the field name
        let folder, filenamePrefix;
        if (req.file.fieldname === 'proof_of_payment') {
            folder = 'proof-of-payments';
            filenamePrefix = 'payment-proof';
        } else {
            folder = 'event-posters';
            filenamePrefix = 'event-poster';
        }

        const filename = `${filenamePrefix}-${uniqueSuffix}`;

        // Upload to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'image',
                    public_id: filename,
                    folder: folder,
                    format: 'webp',
                    quality: 'auto',
                    fetch_format: 'auto'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(webpBuffer);
        });

        // Update req.file with Cloudinary information
        req.file.cloudinaryUrl = uploadResult.secure_url;
        req.file.cloudinaryPublicId = uploadResult.public_id;
        req.file.path = uploadResult.secure_url; // Keep this for backward compatibility

        next();
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        next(error);
    }
};

module.exports = {
    upload,
    convertToWebpAndUpload
};