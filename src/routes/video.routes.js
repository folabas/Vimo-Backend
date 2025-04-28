const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const { upload } = require('../services/cloudinaryService');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Upload video
router.post('/upload', upload.single('video'), videoController.uploadVideo);

// Get all videos for current user
router.get('/', videoController.getVideos);

// Add a specific route for user videos to avoid conflict with :id parameter
router.get('/user', videoController.getVideos);

// Get video by ID
router.get('/:id', videoController.getVideoById);

// Delete video
router.delete('/:id', videoController.deleteVideo);

module.exports = router;
