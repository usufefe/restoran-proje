const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Önce mevcut verileri temizle
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.table.deleteMany();
  await prisma.kitchenTicket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.tenant.deleteMany();

  // Tenant oluştur
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Restaurant Group',
    },
  });

  console.log('✅ Tenant created:', tenant.name);

  // Restaurant oluştur
  const restaurant = await prisma.restaurant.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Restaurant',
      address: 'İstanbul, Türkiye',
      kdvSchema: 'standard',
      currency: 'TRY',
    },
  });

  console.log('✅ Restaurant created:', restaurant.name);

  // Admin kullanıcı oluştur
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: 'ADMIN',
      name: 'Admin User',
      email: 'admin@demo.com',
      hash: hashedPassword,
      isActive: true,
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Chef kullanıcı oluştur
  const chefHash = await bcrypt.hash('chef123', 10);
  const chefUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: 'CHEF',
      name: 'Şef Ahmet',
      email: 'chef@demo.com',
      hash: chefHash,
      isActive: true,
    },
  });

  console.log('✅ Chef user created:', chefUser.email);

  // Waiter kullanıcı oluştur
  const waiterHash = await bcrypt.hash('waiter123', 10);
  const waiterUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      role: 'WAITER',
      name: 'Garson Ayşe',
      email: 'waiter@demo.com',
      hash: waiterHash,
      isActive: true,
    },
  });

  console.log('✅ Waiter user created:', waiterUser.email);

  // Masalar oluştur
  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const table = await prisma.table.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        code: `T${i.toString().padStart(2, '0')}`,
        name: `Masa ${i}`,
        isActive: true,
      },
    });
    tables.push(table);
  }

  console.log('✅ Created', tables.length, 'tables');

  // Menü kategorileri oluştur
  const categories = await Promise.all([
    prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        name: 'Başlangıçlar',
        sort: 1,
        isActive: true,
      },
    }),
    prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        name: 'Ana Yemekler',
        sort: 2,
        isActive: true,
      },
    }),
    prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        name: 'İçecekler',
        sort: 3,
        isActive: true,
      },
    }),
    prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        name: 'Tatlılar',
        sort: 4,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Created', categories.length, 'categories');

  // Menü ürünleri oluştur
  const menuItems = await Promise.all([
    // Başlangıçlar
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        name: 'Çorba',
        description: 'Günün çorbası',
        price: 45.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[0].id,
        name: 'Salata',
        description: 'Mevsim salatası',
        price: 65.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    // Ana Yemekler
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Izgara Köfte',
        description: 'Özel ızgara köfte',
        price: 180.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[1].id,
        name: 'Tavuk Şiş',
        description: 'Izgara tavuk şiş',
        price: 160.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    // İçecekler
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        name: 'Kola',
        description: 'Soğuk kola',
        price: 30.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[2].id,
        name: 'Ayran',
        description: 'Ev yapımı ayran',
        price: 20.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
    // Tatlılar
    prisma.menuItem.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        categoryId: categories[3].id,
        name: 'Sütlaç',
        description: 'Fırın sütlaç',
        price: 50.00,
        vatRate: 18.00,
        isActive: true,
      },
    }),
  ]);

  console.log('✅ Created', menuItems.length, 'menu items');

  console.log('🎉 Seeding completed!');
  console.log('');
  console.log('📋 Login credentials:');
  console.log('Admin: admin@demo.com / admin123');
  console.log('Chef: chef@demo.com / chef123');
  console.log('Waiter: waiter@demo.com / waiter123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

