const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menu');
const orderRoutes = require('./routes/orders');
const sessionRoutes = require('./routes/session');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/admin', adminRoutes);

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-table', (data) => {
    const { tenantId, restaurantId, tableId } = data;
    const room = `table:${tenantId}:${restaurantId}:${tableId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('join-kitchen', (data) => {
    const { restaurantId, station } = data;
    const room = `kitchen:${restaurantId}:${station}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined kitchen room: ${room}`);
  });

  socket.on('join-restaurant', (data) => {
    const { restaurantId } = data;
    const room = `restaurant:${restaurantId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined restaurant room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server, io, prisma };

