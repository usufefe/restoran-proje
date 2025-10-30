const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/waiter-call/create
 * Create waiter call (PUBLIC - no auth needed for customers)
 */
router.post('/create', async (req, res) => {
  try {
    const { tenantId, restaurantId, tableId, type, note } = req.body;

    if (!tenantId || !restaurantId || !tableId || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const validTypes = ['CALL_WAITER', 'REQUEST_BILL'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid call type' });
    }

    // Check if table exists
    const table = await prisma.table.findUnique({
      where: { id: tableId },
      include: { restaurant: true }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check if there's already a pending call for this table
    const existingCall = await prisma.waiterCall.findFirst({
      where: {
        tableId,
        type,
        status: 'PENDING'
      }
    });

    if (existingCall) {
      return res.status(400).json({ 
        error: 'Already have a pending call',
        callId: existingCall.id 
      });
    }

    // Create waiter call
    const waiterCall = await prisma.waiterCall.create({
      data: {
        tenantId,
        restaurantId,
        tableId,
        type,
        note,
        status: 'PENDING'
      },
      include: {
        table: true
      }
    });

    // Emit WebSocket event to assign to next waiter (round-robin)
    const io = req.app.get('io');
    if (io) {
      // Get all active waiters for this restaurant
      const waiters = await prisma.user.findMany({
        where: {
          tenantId,
          role: 'WAITER',
          isActive: true
        }
      });

      if (waiters.length > 0) {
        // Simple round-robin: use call ID modulo to select waiter
        // This ensures fair distribution without storing state
        const waiterIndex = parseInt(waiterCall.id.charCodeAt(0)) % waiters.length;
        const assignedWaiter = waiters[waiterIndex];

        // Emit to restaurant room (all waiters see it)
        io.to(`restaurant:${restaurantId}`).emit('waiter.call.created', {
          callId: waiterCall.id,
          tableCode: table.code,
          tableName: table.name,
          type: waiterCall.type,
          note: waiterCall.note,
          assignedWaiterId: assignedWaiter.id,
          assignedWaiterName: assignedWaiter.name,
          createdAt: waiterCall.createdAt
        });

        // Special notification to assigned waiter
        io.to(`waiter:${assignedWaiter.id}`).emit('waiter.call.assigned', {
          callId: waiterCall.id,
          tableCode: table.code,
          tableName: table.name,
          type: waiterCall.type,
          note: waiterCall.note,
          priority: true
        });
      }
    }

    res.status(201).json({
      callId: waiterCall.id,
      type: waiterCall.type,
      status: waiterCall.status,
      tableCode: table.code,
      tableName: table.name
    });
  } catch (error) {
    console.error('Waiter call creation error:', error);
    res.status(500).json({ error: 'Failed to create waiter call' });
  }
});

/**
 * GET /api/waiter-call/restaurant/:restaurantId
 * Get waiter calls for a restaurant (staff only)
 */
router.get('/restaurant/:restaurantId', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query;

    const whereClause = { restaurantId };
    
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      whereClause.status = { in: statusArray };
    } else {
      // Default: only show active calls
      whereClause.status = { in: ['PENDING', 'ACKNOWLEDGED'] };
    }

    const calls = await prisma.waiterCall.findMany({
      where: whereClause,
      include: {
        table: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(calls.map(call => ({
      id: call.id,
      type: call.type,
      status: call.status,
      note: call.note,
      table: {
        code: call.table.code,
        name: call.table.name
      },
      createdAt: call.createdAt,
      acknowledgedAt: call.acknowledgedAt,
      completedAt: call.completedAt
    })));
  } catch (error) {
    console.error('Waiter calls fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch waiter calls' });
  }
});

/**
 * PATCH /api/waiter-call/:callId/status
 * Update waiter call status (staff only)
 */
router.patch('/:callId/status', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'ACKNOWLEDGED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = { status };
    
    if (status === 'ACKNOWLEDGED') {
      updateData.acknowledgedAt = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const waiterCall = await prisma.waiterCall.update({
      where: { id: callId },
      data: updateData,
      include: {
        table: true
      }
    });

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${waiterCall.restaurantId}`).emit('waiter.call.updated', {
        callId: waiterCall.id,
        status: waiterCall.status,
        tableCode: waiterCall.table.code
      });

      // Notify customer table if completed
      if (status === 'COMPLETED') {
        io.to(`table:${waiterCall.tenantId}:${waiterCall.restaurantId}:${waiterCall.tableId}`).emit('waiter.call.completed', {
          callId: waiterCall.id,
          type: waiterCall.type
        });
      }
    }

    res.json({
      callId: waiterCall.id,
      status: waiterCall.status,
      updatedAt: waiterCall.updatedAt
    });
  } catch (error) {
    console.error('Waiter call status update error:', error);
    res.status(500).json({ error: 'Failed to update waiter call status' });
  }
});

/**
 * DELETE /api/waiter-call/:callId
 * Delete/cancel waiter call
 */
router.delete('/:callId', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;

    const waiterCall = await prisma.waiterCall.delete({
      where: { id: callId },
      include: {
        table: true
      }
    });

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${waiterCall.restaurantId}`).emit('waiter.call.deleted', {
        callId: waiterCall.id,
        tableCode: waiterCall.table.code
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Waiter call deletion error:', error);
    res.status(500).json({ error: 'Failed to delete waiter call' });
  }
});

module.exports = router;

