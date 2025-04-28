const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Log Cloudinary configuration status
console.log('Cloudinary configuration:', {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Not set',
  apiKey: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
  apiSecret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
});

// Configure temporary disk storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept more video file types
    const filetypes = /mp4|webm|ogg|mov|avi|mkv/;
    const mimetype = filetypes.test(file.mimetype);
    
    console.log('File upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size || 'Unknown size',
      accepted: mimetype
    });
    
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error(`Only video files are allowed. Received: ${file.mimetype}`));
  }
});

// Function to upload a file to Cloudinary
const uploadToCloudinary = async (filePath) => {
  try {
    console.log(`Starting Cloudinary upload for file: ${filePath}`);
    console.log('Upload options:', {
      resourceType: 'video',
      folder: 'cinesync_videos'
    });
    
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'video',
      folder: 'cinesync_videos',
    });
    
    console.log('Cloudinary upload completed successfully');
    console.log('Upload result summary:', {
      publicId: result.public_id,
      url: result.secure_url,
      format: result.format,
      duration: result.duration || 'Unknown'
    });
    
    // Delete the local file after upload
    fs.unlinkSync(filePath);
    console.log(`Local file deleted: ${filePath}`);
    
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error.message);
    
    // Delete the local file if upload failed
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Local file deleted after error: ${filePath}`);
    }
    throw error;
  }
};

module.exports = { cloudinary, upload, uploadToCloudinary };
