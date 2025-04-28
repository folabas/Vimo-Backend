const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  hostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movie: {
    id: String,
    title: String,
    source: String,
    thumbnail: String,
    duration: mongoose.Schema.Types.Mixed // Can be number or string
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  subtitlesEnabled: {
    type: Boolean,
    default: false
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    profilePicture: String,
    name: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentTime: {
    type: Number,
    default: 0
  },
  isPlaying: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Generate a unique room code
RoomSchema.statics.generateRoomCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

RoomSchema.methods.addParticipant = function (participant) {
  // Deduplicate participants by userId
  const uniqueParticipants = new Map(
    [...this.participants, participant].map((p) => [p.userId.toString(), p])
  );
  this.participants = Array.from(uniqueParticipants.values());
  this.lastActivity = new Date(); // Update last activity
};

RoomSchema.methods.removeParticipant = function (userId) {
  // Remove the participant by userId
  this.participants = this.participants.filter(p => p.userId.toString() !== userId.toString());
  this.lastActivity = new Date(); // Update last activity
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
