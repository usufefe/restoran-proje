const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { generateQRToken } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/session/open
 * Open a new table session from QR code
 */
router.post('/open', async (req, res) => {
  try {
    const { tenantId, restaurantId, tableId } = req.body;

    if (!tenantId || !restaurantId || !tableId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify table exists
    const table = await prisma.table.findFirst({
      where: {
        id: tableId,
        tenantId,
        restaurantId,
        isActive: true
      },
      include: {
        restaurant: true
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Close any existing active sessions for this table
    await prisma.tableSession.updateMany({
      where: {
        tableId,
        active: true
      },
      data: {
        active: false,
        closedAt: new Date()
      }
    });

    // Create new session
    const sessionToken = uuidv4();
    const session = await prisma.tableSession.create({
      data: {
        tenantId,
        restaurantId,
        tableId,
        sessionToken,
        active: true
      }
    });

    // Generate JWT token for this session
    const token = generateQRToken({
      tenantId,
      restaurantId,
      tableId,
      jti: sessionToken
    });

    res.json({
      sessionId: session.id,
      token,
      table: {
        id: table.id,
        name: table.name,
        code: table.code
      },
      restaurant: {
        id: table.restaurant.id,
        name: table.restaurant.name
      }
    });
  } catch (error) {
    console.error('Session open error:', error);
    res.status(500).json({ error: 'Failed to open session' });
  }
});

/**
 * GET /api/session/qr/:tableId
 * Generate QR code for a table
 */
router.get('/qr/:tableId', async (req, res) => {
  try {
    const { tableId } = req.params;

    // Get table info
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: {
        restaurant: true,
        tenant: true
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Generate QR URL
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrUrl = `${baseUrl}/menu/${table.tenantId}/${table.restaurantId}/${table.id}`;

    // Generate QR code image
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.json({
      qrUrl,
      qrCodeImage: qrCodeDataUrl,
      table: {
        id: table.id,
        name: table.name,
        code: table.code
      },
      restaurant: {
        name: table.restaurant.name
      }
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

/**
 * POST /api/session/close
 * Close current table session
 */
router.post('/close', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = await prisma.tableSession.update({
      where: { id: sessionId },
      data: {
        active: false,
        closedAt: new Date()
      }
    });

    res.json({ message: 'Session closed successfully' });
  } catch (error) {
    console.error('Session close error:', error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

module.exports = router;

