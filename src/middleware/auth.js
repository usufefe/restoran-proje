const { verifyToken } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Middleware to verify JWT token for admin/staff routes
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid or inactive user' });
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware to verify QR token for customer routes
 */
async function authenticateQRToken(req, res, next) {
  const token = req.query.t || req.body.token;

  if (!token) {
    return res.status(401).json({ error: 'QR token required' });
  }

  try {
    const decoded = verifyToken(token);
    
    // Verify session exists and is active
    const session = await prisma.tableSession.findUnique({
      where: { 
        sessionToken: decoded.jti,
        active: true
      },
      include: {
        table: {
          include: {
            restaurant: true
          }
        }
      }
    });

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.session = session;
    req.tenantId = session.tenantId;
    req.restaurantId = session.restaurantId;
    req.tableId = session.tableId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid QR token' });
  }
}

/**
 * Middleware to check user role
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authenticateQRToken,
  requireRole
};

