const Video = require('../models/Video');
const { cloudinary, uploadToCloudinary } = require('../services/cloudinaryService');
const fs = require('fs');
const path = require('path');

// Upload a video
exports.uploadVideo = async (req, res) => {
  try {
    console.log('Starting video upload process...');
    
    if (!req.file) {
      console.log('Error: No video file provided');
      return res.status(400).json({ message: 'No video file provided' });
    }
    
    console.log(`Video file received: ${req.file.originalname}`);
    console.log('File details:', {
      path: req.file.path || 'No path',
      size: req.file.size,
      mimetype: req.file.mimetype,
      filename: req.file.filename || 'No filename',
      destination: req.file.destination || 'No destination'
    });
    
    // Check if file exists on disk
    if (!req.file.path || !fs.existsSync(req.file.path)) {
      console.error('Error: File not found on disk');
      return res.status(500).json({ message: 'Error: File not found on disk' });
    }
    
    try {
      // Upload to Cloudinary
      console.log(`Uploading file to Cloudinary: ${req.file.path}`);
      const cloudinaryResult = await uploadToCloudinary(req.file.path);
      console.log('Cloudinary upload successful:', {
        publicId: cloudinaryResult.public_id,
        url: cloudinaryResult.secure_url,
        format: cloudinaryResult.format,
        resourceType: cloudinaryResult.resource_type
      });
      
      // Create video record in database
      const video = new Video({
        title: req.body.title || req.file.originalname.split('.')[0],
        description: req.body.description || '',
        videoUrl: cloudinaryResult.secure_url,
        publicId: cloudinaryResult.public_id,
        thumbnailUrl: cloudinary.url(cloudinaryResult.public_id, { 
          resource_type: 'video',
          format: 'jpg',
          transformation: [
            { width: 640, height: 360, crop: 'fill' }
          ]
        }),
        duration: cloudinaryResult.duration || 0,
        owner: req.user._id
      });

      // Save video to database
      await video.save();
      console.log(`Video successfully saved to database. ID: ${video._id}`);
      
      console.log('Final video data:', {
        id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration
      });
      
      return res.status(201).json({
        message: 'Video uploaded successfully',
        video
      });
    } catch (cloudinaryError) {
      console.error('Error uploading to Cloudinary:', cloudinaryError);
      
      // Clean up local file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(500).json({ 
        message: 'Error uploading video to cloud storage',
        error: cloudinaryError.message
      });
    }
  } catch (error) {
    console.error('Error in upload process:', error);
    
    // Clean up local file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ 
      message: 'Error uploading video',
      error: error.message
    });
  }
};

exports.getVideos = async (req, res) => {
  try {
    const videos = await Video.find({ owner: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ message: 'Failed to fetch videos' });
  }
};

exports.getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ message: 'Failed to fetch video' });
  }
};

exports.deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }
    
    // Check if user owns the video
    if (video.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this video' });
    }
    
    try {
      // Delete from Cloudinary
      console.log(`Deleting video from Cloudinary for public ID: ${video.publicId}`);
      await cloudinary.uploader.destroy(video.publicId, { resource_type: 'video' });
      console.log('Cloudinary video deleted:', 'Success');
    } catch (cloudinaryError) {
      console.error('Error deleting video from Cloudinary:', cloudinaryError);
      return res.status(500).json({ 
        message: 'Error deleting video from Cloudinary',
        error: cloudinaryError.message
      });
    }
    
    // Delete from database
    await Video.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: 'Failed to delete video' });
  }
};
