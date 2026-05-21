'use strict';

/**
 * index.js
 * Entry point for the Messenger real-time server.
 *
 * - Express HTTP server (REST API foundation)
 * - Socket.io server for real-time events
 * - userId → socketId registry for targeted broadcasts
 */

require('dotenv').config();

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { Server } = require('socket.io');

const jwt = require('jsonwebtoken');

const { verifyConnection }         = require('./db');
const socketState                  = require('./socketState');
const { registerMessageHandlers }  = require('./socketHandlers/messageHandler');
const { registerActivityHandlers } = require('./socketHandlers/activityHandler');
const { registerPresenceHandlers, broadcastPresenceChange } = require('./socketHandlers/presenceHandler');
const { registerWebRTCHandlers }   = require('./socketHandlers/webrtcHandler');
const { registerCommunityHandlers } = require('./socketHandlers/communityHandler');
const { registerGroupHandlers }    = require('./socketHandlers/groupHandler');
const authRoutes                   = require('./routes/auth');
const usersRoutes                  = require('./routes/users');
const messagesRoutes               = require('./routes/messages');
const friendsRoutes                = require('./routes/friends');
const communityRoutes              = require('./routes/community');
const groupsRoutes                 = require('./routes/groups');
const { authLimiter, apiLimiter }  = require('./middleware/rateLimiter');
const { sanitizeBody }             = require('./middleware/sanitize');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

// ── Express ──────────────────────────────────────────────────────────────────

const app = express();

app.use(cors({
    origin: (origin, callback) => {
        const allowed = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        // Allow exact match or any vercel.app subdomain
        if (origin === allowed || origin.endsWith('.vercel.app') || origin === 'http://localhost:5173') {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBody); // strip HTML from all string body fields

// ── Routes ───────────────────────────────────────────────────────────────────

// Auth routes — strict rate limit (10 req / 15 min per IP)
app.use('/auth', authLimiter, authRoutes);

// Protected API routes — general rate limit (200 req / min per IP)
app.use('/users',    apiLimiter, usersRoutes);
app.use('/messages', apiLimiter, messagesRoutes);
app.use('/friends',  apiLimiter, friendsRoutes);
app.use('/community', apiLimiter, communityRoutes);
app.use('/groups',   apiLimiter, groupsRoutes);

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── HTTP + Socket.io ─────────────────────────────────────────────────────────

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || origin.endsWith('.vercel.app') || origin === 'http://localhost:5173') {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingInterval: 25000,
    pingTimeout:  60000,
    maxHttpBufferSize: 10e6,  // 10 MB — allows image/avatar payloads
});

// ── userId → socketId registry ───────────────────────────────────────────────
// Maps a numeric DB user ID to the socket.id of their active connection.
// For horizontal scaling, replace with a Redis adapter.
const userSocketMap = new Map(); // Map<userId: number, socketId: string>

// Share io and userSocketMap with routes/handlers via socketState singleton
socketState.setIo(io);
socketState.setUserSocketMap(userSocketMap);

// ── Socket.io JWT middleware ──────────────────────────────────────────────────
// Clients must pass their JWT as a handshake auth token:
//   io({ auth: { token: 'Bearer <jwt>' } })
// The decoded userId is attached to socket.data.userId before any event fires.
io.use((socket, next) => {
    const authToken = socket.handshake.auth?.token;

    if (!authToken || !authToken.startsWith('Bearer ')) {
        return next(new Error('Authentication token is required.'));
    }

    const token = authToken.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.data.userId = decoded.sub;
        next();
    } catch (err) {
        next(new Error('Invalid or expired token.'));
    }
});

// ── Connection lifecycle ─────────────────────────────────────────────────────

io.on('connection', async (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // userId is already verified and set by the JWT middleware above
    const userId = socket.data.userId;

    const existingSocketId = userSocketMap.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`[Socket.io] User ${userId} reconnected — replacing stale socket ${existingSocketId}.`);
    }

    userSocketMap.set(userId, socket.id);

    console.log(`[Socket.io] User ${userId} authenticated on socket ${socket.id}.`);

    await broadcastPresenceChange(userId, 'online', io, userSocketMap);

    socket.emit('authenticated', { userId, socketId: socket.id });

    // Register domain handlers
    registerMessageHandlers(socket, io);
    registerActivityHandlers(socket, io, userSocketMap);
    registerPresenceHandlers(socket, io, userSocketMap);
    registerWebRTCHandlers(socket, io, userSocketMap);
    registerCommunityHandlers(socket, io);
    registerGroupHandlers(socket, io);

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
        const disconnectedUserId = socket.data.userId;
        console.log(`[Socket.io] Client disconnected: ${socket.id} (reason: ${reason})`);

        if (disconnectedUserId && userSocketMap.get(disconnectedUserId) === socket.id) {
            userSocketMap.delete(disconnectedUserId);
            await broadcastPresenceChange(disconnectedUserId, 'offline', io, userSocketMap);
        }
    });
});

// ── Boot ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '4000', 10);

(async () => {
    try {
        await verifyConnection();
        httpServer.listen(PORT, () => {
            console.log(`[Server] Running on http://localhost:${PORT}`);
            console.log(`[Server] Accepting connections from ${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}`);
        });
    } catch (err) {
        console.error('[Server] Failed to start — could not connect to database:', err);
        process.exit(1);
    }
})();
