const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateQRToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/orders/create
 * Create new order from customer cart
 */
router.post('/create', authenticateQRToken, async (req, res) => {
  try {
    const { items } = req.body; // [{ menuItemId, qty, notes }]
    const { tenantId, restaurantId, tableId } = req;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items required' });
    }

    // Validate and get menu items with prices
    const menuItemIds = items.map(item => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        restaurantId,
        isActive: true
      }
    });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'Some menu items not found or inactive' });
    }

    // Calculate totals
    let subtotal = 0;
    let vatTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const menuItem = menuItems.find(mi => mi.id === item.menuItemId);
      const unitPrice = parseFloat(menuItem.price);
      const vatRate = parseFloat(menuItem.vatRate);
      const qty = parseInt(item.qty);

      const itemSubtotal = unitPrice * qty;
      const itemVat = (itemSubtotal * vatRate) / 100;

      subtotal += itemSubtotal;
      vatTotal += itemVat;

      orderItemsData.push({
        menuItemId: item.menuItemId,
        qty,
        unitPrice,
        vatRate,
        notes: item.notes || null,
        status: 'PENDING'
      });
    }

    const grandTotal = subtotal + vatTotal;

    // Create order with items
    const order = await prisma.order.create({
      data: {
        tenantId,
        restaurantId,
        tableId,
        status: 'PENDING',
        subtotal,
        vatTotal,
        grandTotal,
        orderItems: {
          create: orderItemsData
        }
      },
      include: {
        orderItems: {
          include: {
            menuItem: true
          }
        },
        table: true
      }
    });

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${restaurantId}`).emit('order.created', {
        orderId: order.id,
        tableCode: order.table.code,
        tableName: order.table.name,
        status: order.status,
        grandTotal: parseFloat(order.grandTotal),
        itemCount: order.orderItems.length,
        createdAt: order.createdAt
      });

      io.to(`kitchen:${restaurantId}:HOT`).emit('order.created', {
        orderId: order.id,
        tableCode: order.table.code,
        items: order.orderItems.map(item => ({
          name: item.menuItem.name,
          qty: item.qty,
          notes: item.notes
        }))
      });
    }

    res.status(201).json({
      orderId: order.id,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      vatTotal: parseFloat(order.vatTotal),
      grandTotal: parseFloat(order.grandTotal),
      items: order.orderItems.map(item => ({
        id: item.id,
        name: item.menuItem.name,
        qty: item.qty,
        unitPrice: parseFloat(item.unitPrice),
        notes: item.notes,
        status: item.status
      }))
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * GET /api/orders/table/:tableId
 * Get orders for a table (customer view)
 */
router.get('/table/:tableId', authenticateQRToken, async (req, res) => {
  try {
    const { tableId } = req.params;

    const orders = await prisma.order.findMany({
      where: {
        tableId,
        status: { not: 'CLOSED' }
      },
      include: {
        orderItems: {
          include: {
            menuItem: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(orders.map(order => ({
      id: order.id,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      vatTotal: parseFloat(order.vatTotal),
      grandTotal: parseFloat(order.grandTotal),
      createdAt: order.createdAt,
      items: order.orderItems.map(item => ({
        id: item.id,
        name: item.menuItem.name,
        qty: item.qty,
        unitPrice: parseFloat(item.unitPrice),
        notes: item.notes,
        status: item.status
      }))
    })));
  } catch (error) {
    console.error('Table orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/restaurant/:restaurantId
 * Get orders for restaurant (staff view)
 */
router.get('/restaurant/:restaurantId', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status, limit = 50 } = req.query;

    const whereClause = { restaurantId };
    if (status) {
      whereClause.status = status;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        orderItems: {
          include: {
            menuItem: true
          }
        },
        table: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(limit)
    });

    res.json(orders.map(order => ({
      id: order.id,
      status: order.status,
      table: {
        code: order.table.code,
        name: order.table.name
      },
      subtotal: parseFloat(order.subtotal),
      vatTotal: parseFloat(order.vatTotal),
      grandTotal: parseFloat(order.grandTotal),
      createdAt: order.createdAt,
      items: order.orderItems.map(item => ({
        id: item.id,
        name: item.menuItem.name,
        qty: item.qty,
        unitPrice: parseFloat(item.unitPrice),
        notes: item.notes,
        status: item.status
      }))
    })));
  } catch (error) {
    console.error('Restaurant orders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * PATCH /api/orders/:orderId/status
 * Update order status
 */
router.patch('/:orderId/status', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        closedAt: status === 'CLOSED' ? new Date() : null
      },
      include: {
        table: true
      }
    });

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${order.restaurantId}`).emit('order.updated', {
        orderId: order.id,
        status: order.status,
        tableCode: order.table.code
      });

      io.to(`table:${order.tenantId}:${order.restaurantId}:${order.tableId}`).emit('order.updated', {
        orderId: order.id,
        status: order.status
      });
    }

    res.json({
      orderId: order.id,
      status: order.status,
      updatedAt: order.updatedAt
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * PATCH /api/orders/items/:itemId/status
 * Update order item status
 */
router.patch('/items/:itemId/status', authenticateToken, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'FIRED', 'IN_PROGRESS', 'READY', 'SERVED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const orderItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: { status },
      include: {
        order: {
          include: {
            table: true
          }
        },
        menuItem: true
      }
    });

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.to(`restaurant:${orderItem.order.restaurantId}`).emit('orderitem.updated', {
        orderId: orderItem.orderId,
        itemId: orderItem.id,
        itemName: orderItem.menuItem.name,
        status: orderItem.status,
        tableCode: orderItem.order.table.code
      });
    }

    res.json({
      itemId: orderItem.id,
      status: orderItem.status,
      updatedAt: orderItem.updatedAt
    });
  } catch (error) {
    console.error('Order item status update error:', error);
    res.status(500).json({ error: 'Failed to update order item status' });
  }
});

module.exports = router;

