const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Restaurant Group'
    }
  });
  console.log('✅ Created tenant:', tenant.name);

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      tenantId: tenant.id,
      name: 'Lezzet Durağı',
      address: 'Kadıköy, İstanbul',
      currency: 'TRY'
    }
  });
  console.log('✅ Created restaurant:', restaurant.name);

  // Create admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin User',
      email: 'admin@demo.com',
      hash: adminHash,
      role: 'ADMIN',
      isActive: true
    }
  });
  console.log('✅ Created admin user:', admin.email);

  // Create chef user
  const chefHash = await bcrypt.hash('chef123', 10);
  const chef = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Şef Ahmet',
      email: 'chef@demo.com',
      hash: chefHash,
      role: 'CHEF',
      isActive: true
    }
  });
  console.log('✅ Created chef user:', chef.email);

  // Create waiter user
  const waiterHash = await bcrypt.hash('waiter123', 10);
  const waiter = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Garson Ayşe',
      email: 'waiter@demo.com',
      hash: waiterHash,
      role: 'WAITER',
      isActive: true
    }
  });
  console.log('✅ Created waiter user:', waiter.email);

  // Create tables
  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const table = await prisma.table.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        code: `T${i.toString().padStart(2, '0')}`,
        name: `Masa ${i}`,
        isActive: true
      }
    });
    tables.push(table);
  }
  console.log('✅ Created 10 tables');

  // Create menu categories
  const categories = [
    { name: 'Başlangıçlar', sort: 1 },
    { name: 'Ana Yemekler', sort: 2 },
    { name: 'Pizza', sort: 3 },
    { name: 'İçecekler', sort: 4 },
    { name: 'Tatlılar', sort: 5 }
  ];

  const createdCategories = [];
  for (const categoryData of categories) {
    const category = await prisma.menuCategory.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        ...categoryData,
        isActive: true
      }
    });
    createdCategories.push(category);
  }
  console.log('✅ Created menu categories');

  // Create menu items
  const menuItems = [
    // Başlangıçlar
    {
      categoryIndex: 0,
      items: [
        { name: 'Mercimek Çorbası', description: 'Geleneksel mercimek çorbası', price: 25.00 },
        { name: 'Domates Çorbası', description: 'Taze domates çorbası', price: 22.00 },
        { name: 'Çıtır Soğan Halkası', description: 'Altın sarısı soğan halkaları', price: 35.00 },
        { name: 'Mozzarella Stick', description: '6 adet mozzarella çubukları', price: 40.00 }
      ]
    },
    // Ana Yemekler
    {
      categoryIndex: 1,
      items: [
        { name: 'Izgara Köfte', description: 'Özel baharatlarla hazırlanmış köfte', price: 85.00 },
        { name: 'Tavuk Şiş', description: 'Marine edilmiş tavuk şiş', price: 75.00 },
        { name: 'Adana Kebap', description: 'Acılı kıyma kebabı', price: 95.00 },
        { name: 'Karışık Izgara', description: 'Köfte, tavuk, kuzu karışık', price: 120.00 },
        { name: 'Balık Izgara', description: 'Günün taze balığı', price: 110.00 }
      ]
    },
    // Pizza
    {
      categoryIndex: 2,
      items: [
        { name: 'Margherita Pizza', description: 'Domates, mozzarella, fesleğen', price: 65.00 },
        { name: 'Pepperoni Pizza', description: 'Domates, mozzarella, pepperoni', price: 75.00 },
        { name: 'Karışık Pizza', description: 'Sucuk, salam, mantar, biber', price: 85.00 },
        { name: 'Vejeteryan Pizza', description: 'Sebzeli özel pizza', price: 70.00 }
      ]
    },
    // İçecekler
    {
      categoryIndex: 3,
      items: [
        { name: 'Çay', description: 'Geleneksel Türk çayı', price: 8.00 },
        { name: 'Türk Kahvesi', description: 'Orta şekerli Türk kahvesi', price: 15.00 },
        { name: 'Coca Cola', description: '330ml kutu', price: 12.00 },
        { name: 'Fanta', description: '330ml kutu', price: 12.00 },
        { name: 'Su', description: '500ml şişe su', price: 5.00 },
        { name: 'Ayran', description: 'Ev yapımı ayran', price: 10.00 },
        { name: 'Taze Sıkılmış Portakal Suyu', description: 'Taze portakal suyu', price: 25.00 }
      ]
    },
    // Tatlılar
    {
      categoryIndex: 4,
      items: [
        { name: 'Baklava', description: '4 dilim baklava', price: 45.00 },
        { name: 'Künefe', description: 'Sıcak künefe', price: 50.00 },
        { name: 'Sütlaç', description: 'Ev yapımı sütlaç', price: 30.00 },
        { name: 'Tiramisu', description: 'İtalyan tatlısı', price: 40.00 }
      ]
    }
  ];

  for (const categoryItems of menuItems) {
    const category = createdCategories[categoryItems.categoryIndex];
    for (const itemData of categoryItems.items) {
      await prisma.menuItem.create({
        data: {
          tenantId: tenant.id,
          restaurantId: restaurant.id,
          categoryId: category.id,
          ...itemData,
          vatRate: 18.00,
          isActive: true
        }
      });
    }
  }
  console.log('✅ Created menu items');

  console.log('\n🎉 Seeding completed!');
  console.log('\n📋 Demo Credentials:');
  console.log('Admin: admin@demo.com / admin123');
  console.log('Chef: chef@demo.com / chef123');
  console.log('Waiter: waiter@demo.com / waiter123');
  console.log('\n🏪 Restaurant ID:', restaurant.id);
  console.log('🏢 Tenant ID:', tenant.id);
  console.log('🪑 Tables: T01 to T10');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

