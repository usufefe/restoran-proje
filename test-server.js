const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test routes one by one
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./src/routes/auth');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Error loading auth routes:', error.message);
}

try {
  console.log('Loading menu routes...');
  const menuRoutes = require('./src/routes/menu');
  app.use('/api/menu', menuRoutes);
  console.log('✅ Menu routes loaded');
} catch (error) {
  console.error('❌ Error loading menu routes:', error.message);
}

try {
  console.log('Loading session routes...');
  const sessionRoutes = require('./src/routes/session');
  app.use('/api/session', sessionRoutes);
  console.log('✅ Session routes loaded');
} catch (error) {
  console.error('❌ Error loading session routes:', error.message);
}

try {
  console.log('Loading orders routes...');
  const orderRoutes = require('./src/routes/orders');
  app.use('/api/orders', orderRoutes);
  console.log('✅ Orders routes loaded');
} catch (error) {
  console.error('❌ Error loading orders routes:', error.message);
}

try {
  console.log('Loading admin routes...');
  const adminRoutes = require('./src/routes/admin');
  app.use('/api/admin', adminRoutes);
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Error loading admin routes:', error.message);
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});

