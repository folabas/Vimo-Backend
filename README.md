# Vimo Server

Backend server for Vimo - Watch movies together in sync.

## Features

- 🔐 **User Authentication**: Register, login, and profile management
- 🎬 **Room Management**: Create, join, and manage watch rooms
- 🔄 **Real-time Sync**: Synchronize video playback across multiple users
- 💬 **Chat System**: Real-time chat during movie playback
- 🎭 **Reactions**: Send emoji reactions during playback

## Tech Stack

- **Node.js**: JavaScript runtime
- **Express**: Web framework
- **MongoDB**: Database
- **Socket.IO**: Real-time communication
- **JWT**: Authentication

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
```bash
git clone https://github.com/folabas/Vimo.git
cd Vimo/vimo-server
```

2. Install dependencies
```bash
npm install
```

3. Create environment variables
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration

5. Start the development server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user

### Rooms
- `POST /api/rooms` - Create a new room
- `POST /api/rooms/join` - Join an existing room
- `GET /api/rooms/:roomCode` - Get room details
- `POST /api/rooms/:roomCode/leave` - Leave a room

## Socket.IO Events

### Client to Server
- `join-room` - Join a room
- `leave-room` - Leave a room
- `play-video` - Play the video
- `pause-video` - Pause the video
- `seek-video` - Seek to a specific time
- `toggle-subtitles` - Toggle subtitles
- `send-message` - Send a chat message
- `send-reaction` - Send a reaction

### Server to Client
- `room-joined` - Room joined successfully
- `room-left` - Room left successfully
- `video-played` - Video played by a user
- `video-paused` - Video paused by a user
- `video-seeked` - Video seeked by a user
- `subtitles-toggled` - Subtitles toggled by a user
- `message-received` - New chat message received
- `reaction-received` - New reaction received
- `participant-joined` - New participant joined
- `participant-left` - Participant left

## Project Structure

```
vimo-server/
├── src/
│   ├── index.js          # Entry point
│   ├── models/           # Database models
│   │   ├── User.js       # User model
│   │   └── Room.js       # Room model
│   ├── routes/           # API routes
│   │   ├── auth.routes.js # Authentication routes
│   │   └── room.routes.js # Room management routes
│   ├── middleware/       # Middleware functions
│   │   └── auth.js       # Authentication middleware
│   └── socket/           # Socket.IO handlers
│       └── index.js      # Socket event handlers
├── .env.example          # Example environment variables
├── .gitignore            # Git ignore file
├── package.json          # Dependencies and scripts
└── README.md             # Project documentation
```

## License

MIT
