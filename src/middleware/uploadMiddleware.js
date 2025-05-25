const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// Cloudinary storage for images and PDFs
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'gcorg_uploads',
    resource_type: file.mimetype.startsWith('image/') ? 'image' : 'raw',
    format: file.mimetype === 'application/pdf' ? 'pdf' : undefined,
    public_id: Date.now() + '-' + file.originalname.split('.')[0],
  }),
});

const upload = multer({ storage });

module.exports = { upload };