const express = require('express');
const router = express.Router();
const { cloudinary } = require('../services/cloudinaryService');

// Test Cloudinary connection
router.get('/test', async (req, res) => {
  try {
    // This will make a simple API call to Cloudinary to verify credentials
    const result = await cloudinary.api.ping();
    
    res.json({
      success: true,
      message: 'Successfully connected to Cloudinary',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiDetails: result
    });
  } catch (error) {
    console.error('Cloudinary connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Cloudinary',
      error: error.message
    });
  }
});

module.exports = router;
