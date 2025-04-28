require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const authRoutes = require('./routes/auth.routes');
const roomRoutes = require('./routes/room.routes');
const videoRoutes = require('./routes/video.routes');
const cloudinaryTestRoutes = require('./routes/cloudinary-test.routes');
const initializeSocket = require('./socket');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/cloudinary', cloudinaryTestRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Vimo API' });
});

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI.replace('localhost', '127.0.0.1'), {
    serverSelectionTimeoutMS: 5000,
    family: 4 // Force IPv4
  })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export server for testing
module.exports = server;
