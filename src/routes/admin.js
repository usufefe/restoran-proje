const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// All admin routes require authentication
router.use(authenticateToken);

/**
 * GET /api/admin/restaurants
 * Get restaurants for current tenant
 */
router.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: {
            tables: true,
            menuCategories: true,
            orders: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(restaurants.map(restaurant => ({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      currency: restaurant.currency,
      tableCount: restaurant._count.tables,
      categoryCount: restaurant._count.menuCategories,
      orderCount: restaurant._count.orders,
      createdAt: restaurant.createdAt
    })));
  } catch (error) {
    console.error('Restaurants fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

/**
 * POST /api/admin/restaurants
 * Create new restaurant (admin only)
 */
router.post('/restaurants', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, address, currency = 'TRY' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Restaurant name required' });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        tenantId: req.tenantId,
        name,
        address,
        currency
      }
    });

    res.status(201).json({
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      currency: restaurant.currency
    });
  } catch (error) {
    console.error('Restaurant creation error:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

/**
 * GET /api/admin/restaurants/:restaurantId/tables
 * Get tables for a restaurant
 */
router.get('/restaurants/:restaurantId/tables', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const tables = await prisma.table.findMany({
      where: {
        restaurantId,
        tenantId: req.tenantId
      },
      orderBy: { code: 'asc' }
    });

    res.json(tables.map(table => ({
      id: table.id,
      code: table.code,
      name: table.name,
      isActive: table.isActive,
      createdAt: table.createdAt
    })));
  } catch (error) {
    console.error('Tables fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

/**
 * POST /api/admin/restaurants/:restaurantId/tables
 * Create new table
 */
router.post('/restaurants/:restaurantId/tables', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { code, name } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Table code and name required' });
    }

    // Check if table code already exists in this restaurant
    const existingTable = await prisma.table.findFirst({
      where: {
        restaurantId,
        code
      }
    });

    if (existingTable) {
      return res.status(400).json({ error: 'Table code already exists' });
    }

    const table = await prisma.table.create({
      data: {
        tenantId: req.tenantId,
        restaurantId,
        code,
        name,
        isActive: true
      }
    });

    res.status(201).json({
      id: table.id,
      code: table.code,
      name: table.name,
      isActive: table.isActive
    });
  } catch (error) {
    console.error('Table creation error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

/**
 * GET /api/admin/restaurants/:restaurantId/menu
 * Get menu categories and items for management
 */
router.get('/restaurants/:restaurantId/menu', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        tenantId: req.tenantId
      },
      include: {
        menuItems: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { sort: 'asc' }
    });

    res.json(categories.map(category => ({
      id: category.id,
      name: category.name,
      sort: category.sort,
      isActive: category.isActive,
      items: category.menuItems.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        vatRate: parseFloat(item.vatRate),
        sku: item.sku,
        isActive: item.isActive
      }))
    })));
  } catch (error) {
    console.error('Menu fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

/**
 * POST /api/admin/restaurants/:restaurantId/categories
 * Create new menu category
 */
router.post('/restaurants/:restaurantId/categories', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, sort = 0 } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name required' });
    }

    const category = await prisma.menuCategory.create({
      data: {
        tenantId: req.tenantId,
        restaurantId,
        name,
        sort,
        isActive: true
      }
    });

    res.status(201).json({
      id: category.id,
      name: category.name,
      sort: category.sort,
      isActive: category.isActive
    });
  } catch (error) {
    console.error('Category creation error:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * POST /api/admin/restaurants/:restaurantId/items
 * Create new menu item
 */
router.post('/restaurants/:restaurantId/items', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { categoryId, name, description, price, vatRate = 18.00, sku } = req.body;

    if (!categoryId || !name || !price) {
      return res.status(400).json({ error: 'Category, name and price required' });
    }

    const item = await prisma.menuItem.create({
      data: {
        tenantId: req.tenantId,
        restaurantId,
        categoryId,
        name,
        description,
        price: parseFloat(price),
        vatRate: parseFloat(vatRate),
        sku,
        isActive: true
      }
    });

    res.status(201).json({
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      vatRate: parseFloat(item.vatRate),
      sku: item.sku,
      isActive: item.isActive
    });
  } catch (error) {
    console.error('Menu item creation error:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

/**
 * GET /api/admin/users
 * Get users for current tenant (admin only)
 */
router.get('/users', requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * PATCH /api/admin/users/:userId/status
 * Update user active status (admin only)
 */
router.patch('/users/:userId/status', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }

    const user = await prisma.user.update({
      where: {
        id: userId,
        tenantId: req.tenantId
      },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    res.json(user);
  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;

