import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/db.js';
import prisma from '../config/prisma.js';
import { categories, products, users, addressSeeds, DEFAULT_PASSWORD, hashPassword } from './seedData.js';

const FLOW_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

const pick = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const resetDatabase = async () => {
  console.log('[Seed] Resetting database...');
  // Dependency order matters: children before parents (cascades handle most,
  // but explicit ordering keeps it predictable).
  await prisma.payment.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlistProduct.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.review.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
};

const run = async () => {
  await connectDB();

  const args = process.argv.slice(2);
  if (args.includes('--reset')) {
    await resetDatabase();
  } else {
    // idempotent-ish: refuse to seed over existing data
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log('[Seed] Database already has data. Use `npm run seed:reset` to wipe and reseed.');
      await disconnectDB();
      process.exit(0);
    }
  }

  // 1. Categories
  const createdCategories = [];
  for (const c of categories) {
    createdCategories.push(await prisma.category.create({ data: c }));
  }
  const catMap = Object.fromEntries(createdCategories.map((c) => [c.slug, c.id]));
  console.log(`[Seed] Categories: ${createdCategories.length}`);

  // 2. Products
  const createdProducts = [];
  for (const p of products) {
    const { category: _categorySlug, ...rest } = p;
    createdProducts.push(
      await prisma.product.create({
        data: {
          ...rest,
          categoryId: catMap[p.category],
          slug: slugify(p.name),
        },
      })
    );
  }
  console.log(`[Seed] Products: ${createdProducts.length}`);

  // 3. Users
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@shopsphere.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const seededUsers = [];
  for (const u of users) {
    const password = u.role === 'admin' ? adminPassword : DEFAULT_PASSWORD;
    const seeded = await prisma.user.create({
      data: {
        fullname: u.fullname,
        email: u.email,
        phone: '9' + String(1000000000 + Math.floor(Math.random() * 8999999999)),
        password: hashPassword(password),
        role: u.role,
      },
    });
    seededUsers.push(seeded);
    console.log(`  -> ${u.email}  (${u.role})  password: ${password}`);
  }
  const customers = seededUsers.filter((u) => u.role === 'customer');

  // 4. Addresses
  const createdAddresses = [];
  for (let i = 0; i < Math.min(addressSeeds.length, customers.length); i++) {
    const addr = await prisma.address.create({
      data: { ...addressSeeds[i], userId: customers[i].id, isDefault: i === 0 },
    });
    createdAddresses.push(addr);
  }
  console.log(`[Seed] Addresses: ${createdAddresses.length}`);

  // 5. Orders (spread across statuses + payment states)
  const orders = [];
  let statusIndex = 0;
  for (let i = 0; i < 14; i++) {
    const customer = customers[i % customers.length];
    const addr = createdAddresses[i % createdAddresses.length];
    const itemCount = 1 + (i % 3);
    const chosen = pick(createdProducts, itemCount);

    const items = chosen.map((p) => {
      const qty = 1 + (i % 2);
      return {
        productId: p.id,
        name: p.name,
        image: p.thumbnail,
        brand: p.brand,
        price: p.price,
        mrp: p.mrp,
        quantity: qty,
        subtotal: p.price * qty,
      };
    });

    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const discount = items.reduce((s, it) => s + (it.mrp - it.price) * it.quantity, 0);
    const deliveryCharge = subtotal >= 999 ? 0 : 49;
    const total = subtotal + deliveryCharge;
    const status = FLOW_STATUSES[statusIndex % FLOW_STATUSES.length];
    statusIndex++;

    const paid = i % 3 !== 2; // 2/3 orders paid
    const paidAt = new Date(Date.now() - (i + 2) * 24 * 3600 * 1000);
    const statusLines = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
    const progress = status === 'cancelled' ? 2 : statusLines.indexOf(status) + 1;
    const statusHistory = statusLines.slice(0, progress).map((s, idx) => ({
      status: s,
      at: new Date(paidAt.getTime() + idx * 3600 * 3600),
      note: s === 'delivered' ? 'Package delivered' : `Status updated to ${s.replace(/_/g, ' ')}`,
    }));
    if (status === 'cancelled') {
      statusHistory.push({ status: 'cancelled', at: new Date(paidAt.getTime() + progress * 3600000 + 3600000), note: 'Cancelled by customer' });
    }

    const order = await prisma.order.create({
      data: {
        orderId: 'SP' + paidAt.toISOString().replace(/\D/g, '').slice(0, 8) + String(100000 + i),
        userId: customer.id,
        items: { create: items },
        shippingAddress: {
          fullname: addr.fullname,
          phone: addr.phone,
          address: addr.address,
          apartment: addr.apartment,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
        },
        paymentMethod: i % 2 === 0 ? 'razorpay' : 'cod',
        paymentStatus: paid ? 'paid' : 'pending',
        paymentDetails: paid
          ? {
              razorpayOrderId: 'order_seed_' + i,
              razorpayPaymentId: 'pay_seed_' + i,
              razorpaySignature: 'seed',
              paidAt,
            }
          : {},
        orderStatus: status,
        statusHistory: {
          create: statusHistory.length > 0 ? statusHistory : [{ status: 'pending', note: 'Order placed' }],
        },
        subtotal,
        discount,
        deliveryCharge,
        total,
        createdAt: paidAt,
      },
    });
    orders.push(order);
  }
  console.log(`[Seed] Orders: ${orders.length}`);

  // 6. Reviews (only for products in non-cancelled orders)
  const reviewCopies = [
    { r: 5, t: 'Excellent product!', c: 'Very happy with this purchase. Quality is top notch and delivery was fast.' },
    { r: 4, t: 'Great value for money', c: 'Good quality at this price point. Would recommend to friends.' },
    { r: 5, t: 'Best in segment', c: 'Bought it after researching a lot. Totally worth it. Brand support is great.' },
    { r: 3, t: 'Decent product', c: 'Works fine, but packaging could have been better.' },
  ];
  const reviews = [];
  const reviewed = new Set();
  for (const order of orders) {
    if (order.orderStatus === 'cancelled') continue;
    if (reviews.length >= 12) break;
    const orderItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    for (const it of orderItems.slice(0, 2)) {
      const key = `${order.userId}-${it.productId}`;
      if (reviewed.has(key)) continue;
      reviewed.add(key);
      const rc = reviewCopies[reviews.length % reviewCopies.length];
      await prisma.review.create({
        data: {
          userId: order.userId,
          productId: it.productId,
          rating: rc.r,
          title: rc.t,
          comment: rc.c,
        },
      });
      reviews.push({ productId: it.productId, userId: order.userId });
    }
  }
  console.log(`[Seed] Reviews: ${reviews.length}`);

  // Recompute product ratings
  const productIds = [...new Set(reviews.map((r) => r.productId))];
  for (const pid of productIds) {
    const agg = await prisma.review.aggregate({
      where: { productId: pid },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: pid },
      data: {
        rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
        numReviews: agg._count._all,
      },
    });
  }

  // Seed carts & wishlists for the first few customers so demo accounts feel alive
  for (let i = 0; i < 3; i++) {
    const customer = customers[i];
    const cartItems = pick(createdProducts, 2).map((p) => ({ productId: p.id, quantity: 1 + (i % 2) }));
    await prisma.cart.create({
      data: { userId: customer.id, items: { create: cartItems } },
    });
    await prisma.wishlist.create({
      data: {
        userId: customer.id,
        products: { create: pick(createdProducts, 4).map((p) => ({ productId: p.id })) },
      },
    });
  }
  console.log('[Seed] Carts & wishlists for demo accounts created.');

  console.log('\n============================================');
  console.log('  Seed complete!');
  console.log('  Customers sign in with:  any customer email / Password@123');
  console.log(`  Admin sign in with:        ${adminEmail} / ${adminPassword}`);
  console.log('============================================\n');

  await disconnectDB();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[Seed] Failed:', err);
  await disconnectDB();
  process.exit(1);
});