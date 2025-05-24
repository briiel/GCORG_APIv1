const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Set up multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + path.extname(file.originalname);
        cb(null, uniqueSuffix);
    }
});

const upload = multer({ storage });

// Middleware to convert image to webp after upload
const convertToWebp = async (req, res, next) => {
    if (!req.file) return next();

    const filePath = req.file.path;
    const ext = path.extname(filePath).toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png'];

    if (!allowed.includes(ext)) return next(); // Only convert images

    const webpPath = filePath.replace(ext, '.webp');
    try {
        await sharp(filePath)
            .webp({ quality: 80 })
            .toFile(webpPath);

        // Remove the original file
        fs.unlinkSync(filePath);

        // Update req.file to point to the webp file
        req.file.path = webpPath;
        req.file.filename = path.basename(webpPath);
    } catch (err) {
        console.error('WebP conversion error:', err);
    }
    next();
};

module.exports = {
    upload,
    convertToWebp
};