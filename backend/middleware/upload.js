// middleware/upload.js
// Multer configuration for handling file uploads

const multer = require('multer');
const path = require('path');

// Configure memory storage (files stored in memory as Buffer)
// Better for Cloudinary uploads as we don't need to save to disk
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: fileFilter
});

// Export different upload configurations
module.exports = {
  // Single file upload
  single: (fieldName) => upload.single(fieldName),
  
  // Multiple files upload (same field)
  multiple: (fieldName, maxCount = 10) => upload.array(fieldName, maxCount),
  
  // Multiple files upload (different fields)
  fields: (fields) => upload.fields(fields),
  
  // Upload middleware without file handling (for optional uploads)
  none: () => upload.none()
};
