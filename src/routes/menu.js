const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/menu/:restaurantId
 * Get menu for a restaurant (public endpoint for customers)
 */
router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Get restaurant info
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Get menu categories with items
    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        isActive: true
      },
      include: {
        menuItems: {
          where: {
            isActive: true
          },
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        sort: 'asc'
      }
    });

    res.json({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        currency: restaurant.currency
      },
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        sort: category.sort,
        items: category.menuItems.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: parseFloat(item.price),
          vatRate: parseFloat(item.vatRate),
          sku: item.sku
        }))
      }))
    });
  } catch (error) {
    console.error('Menu fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

/**
 * GET /api/menu/:restaurantId/categories
 * Get menu categories only
 */
router.get('/:restaurantId/categories', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId,
        isActive: true
      },
      orderBy: {
        sort: 'asc'
      }
    });

    res.json(categories.map(category => ({
      id: category.id,
      name: category.name,
      sort: category.sort
    })));
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/menu/:restaurantId/items/:categoryId
 * Get menu items for a specific category
 */
router.get('/:restaurantId/items/:categoryId', async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;

    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        categoryId,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json(items.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: parseFloat(item.price),
      vatRate: parseFloat(item.vatRate),
      sku: item.sku
    })));
  } catch (error) {
    console.error('Items fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

module.exports = router;

