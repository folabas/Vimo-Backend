const express = require('express');
const Room = require('../models/Room');
const router = express.Router();
const auth = require('../middleware/auth');

// Create a new room
router.post('/', auth, async (req, res) => {
  try {
    const { movie, isPrivate, subtitlesEnabled } = req.body;
    
    // Generate a unique room code
    let roomCode;
    let isUnique = false;
    
    while (!isUnique) {
      roomCode = Room.generateRoomCode();
      const existingRoom = await Room.findOne({ roomCode });
      if (!existingRoom) {
        isUnique = true;
      }
    }
    
    // Create new room
    const newRoom = new Room({
      roomCode,
      hostId: req.user.id,
      movie,
      isPrivate,
      subtitlesEnabled,
      participants: [{
        userId: req.user.id,
        username: req.user.username
      }]
    });
    
    // Save room to database
    await newRoom.save();
    
    res.status(201).json({
      roomCode: newRoom.roomCode,
      movie: newRoom.movie,
      isPrivate: newRoom.isPrivate,
      subtitlesEnabled: newRoom.subtitlesEnabled
    });
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(500).json({ message: 'Server error during room creation' });
  }
});

// Join a room
router.post('/join', auth, async (req, res) => {
  try {
    const { roomCode } = req.body;
    
    // Find room by code
    const room = await Room.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Check if room is private
    if (room.isPrivate && room.hostId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'This room is private' });
    }
    
    // Check if user is already in the room
    const isParticipant = room.participants.some(
      p => p.userId.toString() === req.user.id
    );
    
    if (!isParticipant) {
      // Add user to participants
      room.participants.push({
        userId: req.user.id,
        username: req.user.username
      });
      
      // Update last activity
      room.lastActivity = Date.now();
      
      await room.save();
    }
    
    res.json({
      roomCode: room.roomCode,
      movie: room.movie,
      isPrivate: room.isPrivate,
      subtitlesEnabled: room.subtitlesEnabled,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      isHost: room.hostId.toString() === req.user.id
    });
  } catch (error) {
    console.error('Room join error:', error);
    res.status(500).json({ message: 'Server error while joining room' });
  }
});

// Get room details
router.get('/:roomCode', auth, async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    // Find room by code
    const room = await Room.findOne({ roomCode })
      .populate('participants.userId', 'username profilePicture');
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    res.json({
      roomCode: room.roomCode,
      movie: room.movie,
      isPrivate: room.isPrivate,
      subtitlesEnabled: room.subtitlesEnabled,
      isPlaying: room.isPlaying,
      currentTime: room.currentTime,
      participants: room.participants,
      isHost: room.hostId.toString() === req.user.id,
      createdAt: room.createdAt
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Server error while fetching room' });
  }
});

// Leave a room
router.post('/:roomCode/leave', auth, async (req, res) => {
  try {
    const { roomCode } = req.params;
    
    // Find room by code
    const room = await Room.findOne({ roomCode });
    
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    
    // Remove user from participants
    room.participants = room.participants.filter(
      p => p.userId.toString() !== req.user.id
    );
    
    // If host leaves, assign a new host or delete the room if empty
    if (room.hostId.toString() === req.user.id) {
      if (room.participants.length > 0) {
        // Assign the first participant as the new host
        room.hostId = room.participants[0].userId;
      } else {
        // Delete the room if no participants left
        await Room.deleteOne({ _id: room._id });
        return res.json({ message: 'Room deleted successfully' });
      }
    }
    
    // Update last activity
    room.lastActivity = Date.now();
    
    await room.save();
    
    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ message: 'Server error while leaving room' });
  }
});

module.exports = router;
