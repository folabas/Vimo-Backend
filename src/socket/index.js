const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');

/**
 * Initialize Socket.IO with the HTTP server
 * @param {Object} server - HTTP server instance
 * @returns {Object} Socket.IO instance
 */
function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // Helper function to deduplicate participants
  const deduplicateParticipants = async (roomCode) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) return null;
      
      // Log the current participants before deduplication
      console.log(`Room ${roomCode} participants BEFORE deduplication:`);
      room.participants.forEach((p, index) => {
        console.log(`  ${index + 1}. User: ${p.username}, ID: ${p.userId.toString()}`);
      });
      
      // Create a map to track unique participants by userId
      const uniqueParticipants = new Map();
      
      // Keep only the most recent entry for each userId
      room.participants.forEach(participant => {
        uniqueParticipants.set(participant.userId.toString(), participant);
      });
      
      // Convert map values back to array
      room.participants = Array.from(
        new Map(room.participants.map((p) => [p.userId.toString(), p])).values()
      );
      
      // Log the participants after deduplication
      console.log(`Room ${roomCode} participants AFTER deduplication:`);
      room.participants.forEach((p, index) => {
        console.log(`  ${index + 1}. User: ${p.username}, ID: ${p.userId.toString()}`);
      });
      
      // Save the deduplicated participants list
      await room.save();
      
      console.log(`Deduplicated participants in room ${roomCode}. Current count: ${room.participants.length}`);
      return room;
    } catch (error) {
      console.error('Error deduplicating participants:', error);
      return null;
    }
  };

  // Helper function to log all participants in a room
  const logRoomParticipants = async (roomCode) => {
    try {
      const room = await Room.findOne({ roomCode });
      if (!room) {
        // console.log(`Room ${roomCode} not found`);
        return;
      }
      // Suppress participant logs
      // console.log(`\n=== ROOM ${roomCode} PARTICIPANTS (${room.participants.length} total) ===`);
      // room.participants.forEach((p, index) => {
      //   console.log(`  ${index + 1}. User: ${p.username}, ID: ${p.userId.toString()}`);
      // });
      // console.log(`=== END ROOM ${roomCode} PARTICIPANTS ===\n`);
    } catch (error) {
      // console.error('Error logging room participants:', error);
    }
  };

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vimo-secret-key');
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture
      };
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Handle socket connections
  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username}`);
    
    // Store current playback positions for each room
    const roomSyncIntervals = new Map();
    
    // Function to broadcast current playback position to all clients in a room
    const startPlaybackSync = async (roomCode) => {
      // Clear any existing interval for this room
      if (roomSyncIntervals.has(roomCode)) {
        clearInterval(roomSyncIntervals.get(roomCode));
      }
      
      // Set up a new interval to broadcast position every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          const room = await Room.findOne({ roomCode });
          if (!room || !room.isPlaying) return;
          
          // Broadcast current position to all clients in the room
          io.to(roomCode).emit('playback-sync', { 
            currentTime: room.currentTime + (Date.now() - room.lastActivity) / 1000 
          });
        } catch (error) {
          console.error('Error in playback sync:', error);
        }
      }, 2000); // Sync every 2 seconds
      
      roomSyncIntervals.set(roomCode, intervalId);
    };
    
    // Clean up sync interval when room is empty
    const stopPlaybackSync = (roomCode) => {
      if (roomSyncIntervals.has(roomCode)) {
        clearInterval(roomSyncIntervals.get(roomCode));
        roomSyncIntervals.delete(roomCode);
        console.log(`Stopped playback sync for room ${roomCode}`);
      }
    };
    
    // Helper function to handle participant leaving
    const handleParticipantLeft = async (roomCode, userId) => {
      try {
        const room = await Room.findOne({ roomCode });
        if (!room) return;
        
        // Find the participant
        const participantIndex = room.participants.findIndex(
          p => p.userId.toString() === userId.toString()
        );
        
        if (participantIndex !== -1) {
          // Get the participant info before removing
          const participant = room.participants[participantIndex];
          
          // Remove the participant
          room.participants.splice(participantIndex, 1);
          await room.save();
          
          // Notify others
          io.to(roomCode).emit('participant-left', {
            userId: participant.userId,
            username: participant.username
          });
          
          console.log(`${participant.username} left room ${roomCode}`);
          console.log(`Currently ${room.participants.length} participants in room ${roomCode}`);
          
          // If room is empty, clean up
          if (room.participants.length === 0) {
            stopPlaybackSync(roomCode);
          }
        }
      } catch (error) {
        console.error('Error handling participant left:', error);
      }
    };

    // Join a room
    socket.on('join-room', async ({ roomCode }) => {
      try {
        if (!socket.user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }
        
        // Log the joining socket id
        console.log(`[Backend] Socket ${socket.id} (${socket.user.username}) joining room ${roomCode}`);
        
        let room = await Room.findOne({ roomCode });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Store the room code in the socket for tracking
        socket.currentRoom = roomCode;
        
        // Join the socket room
        socket.join(roomCode);
        
        // Create participant object
        const participant = {
          userId: socket.user.id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture || '',
          name: socket.user.name || socket.user.username
        };
        
        // Atomically ensure only one participant per userId
        await Room.updateOne(
          { roomCode },
          [
            {
              $set: {
                participants: {
                  $concatArrays: [
                    {
                      $filter: {
                        input: "$participants",
                        as: "p",
                        cond: { $ne: ["$$p.userId", participant.userId] }
                      }
                    },
                    [participant]
                  ]
                }
              }
            }
          ]
        );

        // Fetch the updated room
        const updatedRoom = await Room.findOne({ roomCode });
        if (!updatedRoom) {
          socket.emit('error', 'Room not found or could not update participants.');
          return;
        }

        // Notify other users about the new participant
        socket.to(roomCode).emit('participant-joined', participant);
        
        console.log(`${socket.user.username} joined room ${roomCode}`);
        
        // Log all participants in the room
        await logRoomParticipants(roomCode);
        
        // Add profile pictures to participants
        const participantsWithProfiles = updatedRoom.participants.map(p => ({
          id: p.userId.toString(),
          username: p.username,
          profilePicture: p.profilePicture || '',
          name: p.name || p.username
        }));
        
        // Log the current number of participants
        console.log(`Currently ${updatedRoom.participants.length} participants in room ${roomCode}`);
        
        let movieData = null;
        if (room.movie) {
          movieData = {
            id: room.movie.id || '',
            title: room.movie.title || '',
            source: room.movie.source || '',
            videoUrl: room.movie.source || '',
            thumbnail: room.movie.thumbnail || '',
            duration: room.movie.duration || '0:00'
          };
        }
        
        socket.emit('room-joined', {
          roomCode: updatedRoom.roomCode,
          selectedMovie: movieData, 
          isPrivate: updatedRoom.isPrivate,
          subtitlesEnabled: updatedRoom.subtitlesEnabled,
          isPlaying: updatedRoom.isPlaying,
          currentTime: updatedRoom.currentTime,
          participants: participantsWithProfiles,
          isHost: updatedRoom.hostId.toString() === socket.user.id.toString(),
          expiration: updatedRoom.expiresAt
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });
    
    // Leave a room
    socket.on('leave-room', async ({ roomCode }) => {
      try {
        // Leave socket room
        socket.leave(roomCode);
        
        // Clear the current room from socket
        socket.currentRoom = null;
        
        // Get room data
        const room = await Room.findOne({ roomCode });
        if (room) {
          // Use the Room model's removeParticipant method
          room.removeParticipant(socket.user.id);
          await room.save();
          
          // Notify other users
          socket.to(roomCode).emit('participant-left', {
            userId: socket.user.id,
            username: socket.user.username
          });
          
          console.log(`${socket.user.username} left room ${roomCode}`);
          
          // Log all participants in the room
          await logRoomParticipants(roomCode);
        }
      } catch (error) {
        console.error('Leave room error:', error);
      }
    });
    
    // --- Playback synchronization handlers ---
    // Helper to check if user is the room host
    async function isRoomHost(roomCode, userId) {
      const room = await Room.findOne({ roomCode });
      return room && room.hostId.toString() === userId.toString();
    }

    // Only host can control playback
    socket.on('play-video', async ({ roomCode, currentTime }) => {
      if (await isRoomHost(roomCode, socket.user.id)) {
        // Log all socket ids in the room before emitting
        const socketsInRoom = await io.in(roomCode).allSockets();
        console.log(`[Backend] Sockets in room ${roomCode}:`, Array.from(socketsInRoom));
        
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            isPlaying: true,
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Start playback sync for this room
        startPlaybackSync(roomCode);
        
        io.to(roomCode).emit('play-video', { currentTime });
        socket.to(roomCode).emit('video-played', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        console.log(`The video is currently being played in room ${roomCode}.`);
        console.log(`User ${socket.user.username} is currently watching.`);
      } else {
        socket.emit('error', { message: 'Only the host can control playback.' });
      }
    });

    socket.on('pause-video', async ({ roomCode, currentTime }) => {
      if (await isRoomHost(roomCode, socket.user.id)) {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            isPlaying: false,
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Stop playback sync for this room while paused
        stopPlaybackSync(roomCode);
        
        io.to(roomCode).emit('pause-video', { currentTime });
        socket.to(roomCode).emit('video-paused', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        console.log(`The video is currently paused in room ${roomCode}.`);
        console.log(`User ${socket.user.username} is currently watching.`);
      } else {
        socket.emit('error', { message: 'Only the host can control playback.' });
      }
    });

    socket.on('seek-video', async ({ roomCode, currentTime }) => {
      if (await isRoomHost(roomCode, socket.user.id)) {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Restart playback sync after seeking
        startPlaybackSync(roomCode);
        
        io.to(roomCode).emit('seek-video', { currentTime });
        socket.to(roomCode).emit('video-seeked', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        console.log(`${socket.user.username} seeked video in room ${roomCode}`);
      } else {
        socket.emit('error', { message: 'Only the host can control playback.' });
      }
    });
    // --- End playback synchronization handlers ---
    
    // Play video
    socket.on('play-video', async ({ roomCode, currentTime }) => {
      try {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            isPlaying: true,
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Broadcast to other users in the room
        socket.to(roomCode).emit('video-played', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        
        console.log(`${socket.user.username} played video in room ${roomCode}`);
      } catch (error) {
        console.error('Play video error:', error);
        socket.emit('error', { message: 'Failed to play video' });
      }
    });
    
    // Pause video
    socket.on('pause-video', async ({ roomCode, currentTime }) => {
      try {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            isPlaying: false,
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Broadcast to other users in the room
        socket.to(roomCode).emit('video-paused', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        
        console.log(`${socket.user.username} paused video in room ${roomCode}`);
      } catch (error) {
        console.error('Pause video error:', error);
        socket.emit('error', { message: 'Failed to pause video' });
      }
    });
    
    // Seek video
    socket.on('seek-video', async ({ roomCode, currentTime }) => {
      try {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            currentTime,
            lastActivity: Date.now()
          }
        );
        
        // Broadcast to other users in the room
        socket.to(roomCode).emit('video-seeked', {
          userId: socket.user.id,
          username: socket.user.username,
          currentTime
        });
        
        console.log(`${socket.user.username} seeked video in room ${roomCode}`);
      } catch (error) {
        console.error('Seek video error:', error);
        socket.emit('error', { message: 'Failed to seek video' });
      }
    });
    
    // Toggle subtitles
    socket.on('toggle-subtitles', async ({ roomCode, enabled }) => {
      try {
        // Update room status
        await Room.updateOne(
          { roomCode },
          { 
            subtitlesEnabled: enabled,
            lastActivity: Date.now()
          }
        );
        
        // Broadcast to other users in the room
        socket.to(roomCode).emit('subtitles-toggled', {
          userId: socket.user.id,
          username: socket.user.username,
          enabled
        });
        
        console.log(`${socket.user.username} toggled subtitles in room ${roomCode}`);
      } catch (error) {
        console.error('Toggle subtitles error:', error);
        socket.emit('error', { message: 'Failed to toggle subtitles' });
      }
    });
    
    // Select video - supporting both kebab-case and UPPER_CASE versions for compatibility
    socket.on('select-video', handleSelectVideo);
    socket.on('SELECT_VIDEO', handleSelectVideo);
    
    // Handler function for selecting videos
    async function handleSelectVideo(movie) {
      try {
        // Get the room code from the socket's rooms
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find(room => room !== socket.id);
        
        if (!roomCode) {
          socket.emit('error', { message: 'You are not in any room' });
          return;
        }
        
        // Ensure we have a source field - prioritize source, then videoUrl
        const sourceUrl = movie.source || movie.videoUrl || '';
        
        console.log(`[SELECT VIDEO] ${socket.user.username} selected video in room ${roomCode}:`, {
          id: movie.id,
          title: movie.title,
          source: sourceUrl,
          hasSource: !!sourceUrl
        });
        
        // Ensure the source field is set
        const movieObject = {
          id: movie.id || `movie-${Date.now()}`,
          title: movie.title || 'Untitled',
          source: sourceUrl,
          videoUrl: sourceUrl, // Set both source and videoUrl for compatibility
          thumbnail: movie.thumbnail || '',
          duration: movie.duration || '0:00'
        };
        
        // Update room with the new movie
        const updatedRoom = await Room.findOneAndUpdate(
          { roomCode },
          { 
            movie: movieObject,
            currentTime: 0,
            isPlaying: false,
            lastActivity: Date.now()
          },
          { new: true }
        ).populate('participants.userId');
        
        if (!updatedRoom) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }
        
        // Extract room state for broadcasting
        const roomState = {
          roomCode: updatedRoom.roomCode,
          selectedMovie: {
            id: updatedRoom.movie.id,
            title: updatedRoom.movie.title,
            source: updatedRoom.movie.source,
            videoUrl: updatedRoom.movie.source, // Include both for compatibility
            thumbnail: updatedRoom.movie.thumbnail,
            duration: updatedRoom.movie.duration
          },
          isPlaying: updatedRoom.isPlaying,
          currentTime: updatedRoom.currentTime,
          subtitlesEnabled: updatedRoom.subtitlesEnabled,
          participants: updatedRoom.participants.map(p => ({
            userId: p.userId._id,
            username: p.userId.username,
            profilePicture: p.userId.profilePicture
          }))
        };
        
        // Log what's being emitted for debugging
        console.log('[SELECT VIDEO] Broadcasting updated room state with movie:', {
          title: roomState.selectedMovie.title,
          source: roomState.selectedMovie.source,
          hasSource: !!roomState.selectedMovie.source
        });
        
        // Broadcast the updated room state to all users in the room
        io.to(roomCode).emit('room-state-update', roomState);
        
        console.log(`Room state updated with new video: ${movie.title}`);
      } catch (error) {
        console.error('Select video error:', error);
        socket.emit('error', { message: 'Failed to select video' });
      }
    }
    
    // Send chat message
    socket.on('send-message', async ({ roomCode, message }) => {
      try {
        // Broadcast to other users in the room
        io.to(roomCode).emit('message-received', {
          userId: socket.user.id,
          username: socket.user.username,
          profilePicture: socket.user.profilePicture,
          message,
          timestamp: Date.now()
        });
        
        console.log(`${socket.user.username} sent message in room ${roomCode}`);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Send reaction
    socket.on('send-reaction', async ({ roomCode, reaction }) => {
      try {
        // Broadcast to other users in the room
        io.to(roomCode).emit('reaction-received', {
          userId: socket.user.id,
          username: socket.user.username,
          reaction,
          timestamp: Date.now()
        });
        
        console.log(`${socket.user.username} sent reaction in room ${roomCode}`);
      } catch (error) {
        console.error('Send reaction error:', error);
        socket.emit('error', { message: 'Failed to send reaction' });
      }
    });
    
    // Handle room-state-update event
    socket.on('room-state-update', async (data) => {
      try {
        const rooms = Array.from(socket.rooms);
        const roomCode = rooms.find(room => room !== socket.id);

        if (!roomCode) {
          socket.emit('error', { message: 'You are not in any room' });
          return;
        }

        const room = await Room.findOne({ roomCode });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const { currentTime, isPlaying, subtitlesEnabled } = data;

        let updatedSelectedMovie = null;
        if (data.selectedMovie) {
          updatedSelectedMovie = {
            id: data.selectedMovie.id || room.movie?.id || '',
            title: data.selectedMovie.title || room.movie?.title || '',
            source: data.selectedMovie.source || data.selectedMovie.videoUrl || room.movie?.source || '',
            videoUrl: data.selectedMovie.source || data.selectedMovie.videoUrl || room.movie?.source || '',
            thumbnail: data.selectedMovie.thumbnail || room.movie?.thumbnail || '',
            duration: data.selectedMovie.duration || room.movie?.duration || '0:00'
          };
        } else if (room.movie) {
          updatedSelectedMovie = {
            id: room.movie.id || '',
            title: room.movie.title || '',
            source: room.movie.source || '',
            videoUrl: room.movie.source || '',
            thumbnail: room.movie.thumbnail || '',
            duration: room.movie.duration || '0:00'
          };
        }

        const updatedRoom = await Room.findOneAndUpdate(
          { roomCode },
          {
            isPlaying: isPlaying !== undefined ? isPlaying : room.isPlaying,
            currentTime: currentTime !== undefined ? currentTime : room.currentTime,
            subtitlesEnabled: subtitlesEnabled !== undefined ? subtitlesEnabled : room.subtitlesEnabled,
            lastActivity: Date.now(),
            movie: updatedSelectedMovie || room.movie
          },
          { new: true }
        ).populate('participants.userId');

        const roomState = {
          roomCode: updatedRoom.roomCode,
          selectedMovie: updatedSelectedMovie,
          isPlaying: updatedRoom.isPlaying,
          currentTime: updatedRoom.currentTime,
          subtitlesEnabled: updatedRoom.subtitlesEnabled,
          participants: updatedRoom.participants.map(p => ({
            userId: p.userId._id,
            username: p.userId.username,
            profilePicture: p.userId.profilePicture
          }))
        };

        io.to(roomCode).emit('room-state-updated', roomState);
      } catch (error) {
        console.error('Error updating room state:', error);
        socket.emit('error', { message: 'Failed to update room state' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user?.username}`);
      
      // Clean up any rooms this user was in
      if (socket.user) {
        const rooms = await Room.find({ 'participants.userId': socket.user.id });
        for (const room of rooms) {
          // Stop playback sync if this was the last user
          const remainingParticipants = room.participants.filter(
            p => p.userId.toString() !== socket.user.id.toString()
          );
          if (remainingParticipants.length === 0) {
            stopPlaybackSync(room.roomCode);
          }
          
          console.log(`${socket.user.username} disconnected from room ${room.roomCode}`);
          await handleParticipantLeft(room.roomCode, socket.user.id);
        }
      }
    });
  });

  return io;
}

module.exports = initializeSocket;
