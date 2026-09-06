import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';
import { ORDER_STATUSES } from '../utils/constants.js';
import { restockItems } from './orderController.js';

const ORDER_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  statusHistory: { orderBy: { at: 'asc' } },
};

const USER_SELECT = { select: { fullname: true, email: true, phone: true } };

const clampPage = (req, def = 1, maxLimit = 15) => {
  const page = Math.max(1, Number(req.query.page) || def);
  const limit = Math.min(50, Number(req.query.limit) || maxLimit);
  return { page, limit };
};

// ============================================================
// DASHBOARD
// ============================================================

/** GET /api/admin/dashboard */
export const getDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const startOfSixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    totalUsers,
    totalProducts,
    totalOrders,
    totalRevenueAgg,
    pendingOrders,
    deliveredOrders,
    lowStock,
    totalCategories,
    revenueRows,
    ordersByStatusRows,
    bestSellerRows,
    recentOrders,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'customer' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { paymentStatus: 'paid', orderStatus: { not: 'cancelled' } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { orderStatus: 'pending' } }),
    prisma.order.count({ where: { orderStatus: 'delivered' } }),
    prisma.product.findMany({
      where: { stock: { lt: 5 } },
      select: { id: true, name: true, thumbnail: true, images: true, price: true, stock: true, brand: true, sku: true },
      orderBy: { stock: 'asc' },
      take: 10,
    }),
    prisma.category.count({ where: { isActive: true } }),
    // paid revenue for the last 6 calendar months
    prisma.order.findMany({
      where: {
        paymentStatus: 'paid',
        orderStatus: { not: 'cancelled' },
        createdAt: { gte: startOfSixMonths },
      },
      select: { createdAt: true, total: true },
    }),
    prisma.order.groupBy({
      by: ['orderStatus'],
      _count: { _all: true },
    }),
    // best sellers by units sold (snapshots in order items)
    prisma.orderItem.findMany({
      where: { order: { orderStatus: { not: 'cancelled' } } },
      select: { productId: true, name: true, image: true, quantity: true, subtotal: true },
    }),
    prisma.order.findMany({
      select: { id: true, orderId: true, orderStatus: true, paymentStatus: true, total: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
  ]);

  // revenue by month - last 6 months
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueByMonthMap = new Map();
  for (const r of revenueRows) {
    const key = `${r.createdAt.getFullYear()}-${r.createdAt.getMonth()}`;
    revenueByMonthMap.set(key, (revenueByMonthMap.get(key) || 0) + r.total);
  }
  const revenueByMonth = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueByMonth.push({
      month: `${monthLabels[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      revenue: revenueByMonthMap.get(`${d.getFullYear()}-${d.getMonth()}`) || 0,
    });
  }

  // orders by status (full wheel of statuses)
  const statusCountMap = new Map(
    ordersByStatusRows.map((row) => [row.orderStatus, row._count._all])
  );
  const statusWheel = ORDER_STATUSES.map((status) => ({
    status,
    count: statusCountMap.get(status) || 0,
  }));

  // best sellers - aggregate order item snapshots by product
  const sellerMap = new Map();
  for (const row of bestSellerRows) {
    if (!row.name) continue;
    const key = row.productId || row.name;
    const entry = sellerMap.get(key) || {
      _id: row.productId,
      name: row.name,
      image: row.image,
      sold: 0,
      revenue: 0,
    };
    entry.sold += row.quantity;
    entry.revenue += row.subtotal;
    sellerMap.set(key, entry);
  }
  const bestSellers = [...sellerMap.values()].sort((a, b) => b.sold - a.sold).slice(0, 5);

  // sales overview - last 14 days (paid) revenue
  const salesOverviewRows = await prisma.order.findMany({
    where: {
      paymentStatus: 'paid',
      orderStatus: { not: 'cancelled' },
      createdAt: { gte: new Date(now.getTime() - 13 * 24 * 3600 * 1000) },
    },
    select: { createdAt: true, total: true },
  });
  const salesByDate = new Map();
  for (const r of salesOverviewRows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    const found = salesByDate.get(key) || { revenue: 0, orders: 0 };
    found.revenue += r.total;
    found.orders += 1;
    salesByDate.set(key, found);
  }
  const salesOverview = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().slice(0, 10);
    const found = salesByDate.get(key);
    salesOverview.push({
      date: key,
      revenue: found ? found.revenue : 0,
      orders: found ? found.orders : 0,
    });
  }

  success(res, 200, {
    stats: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenueAgg._sum.total || 0,
      pendingOrders,
      deliveredOrders,
      lowStock,
      totalCategories,
    },
    charts: {
      revenueByMonth,
      ordersByStatus: statusWheel,
      bestSellers,
      salesOverview,
    },
    recentOrders,
  });
});

// ============================================================
// ORDER MANAGEMENT
// ============================================================

/** GET /api/admin/orders?status=&paymentStatus=&search=&page= */
export const adminListOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, search } = req.query;
  const { page, limit } = clampPage(req, 1, 15);

  const where = {};
  if (status && status !== 'all') where.orderStatus = status;
  if (paymentStatus && paymentStatus !== 'all') where.paymentStatus = paymentStatus;
  if (search) {
    const userIds = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { fullname: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    const or = [{ orderId: { contains: search, mode: 'insensitive' } }];
    if (userIds.length > 0) or.push({ userId: { in: userIds.map((u) => u.id) } });
    where.OR = or;
  }

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { ...ORDER_INCLUDE, user: USER_SELECT },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  success(res, 200, { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

/** GET /api/admin/orders/:id */
export const adminGetOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { ...ORDER_INCLUDE, user: USER_SELECT },
  });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
  success(res, 200, { order });
});

/** PUT /api/admin/orders/:id/status  { status, note } */
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');

  const { status, note } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    throw new AppError(`Invalid order status. Valid: ${ORDER_STATUSES.join(', ')}`, 400, 'INVALID_STATUS');
  }
  if (order.orderStatus === 'cancelled') {
    throw new AppError('Cancelled orders cannot be re-activated.', 400, 'ORDER_CANCELLED');
  }
  if (status === order.orderStatus) {
    const same = await prisma.order.findUnique({
      where: { id: order.id },
      include: { ...ORDER_INCLUDE, user: USER_SELECT },
    });
    return success(res, 200, { order: same }, 'Order status unchanged');
  }

  const data = {
    orderStatus: status,
    statusHistory: { create: [{ status, note: note || `Status updated to ${status.replace(/_/g, ' ')}` }] },
  };
  if (status === 'cancelled') {
    data.cancellable = false;
    data.cancellationReason = note || 'Cancelled by admin';
    await restockItems(order.items);
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data,
    include: { ...ORDER_INCLUDE, user: USER_SELECT },
  });

  success(res, 200, { order: updated }, `Order marked as ${status}`);
});

/** PUT /api/admin/orders/:id/payment  { paymentStatus } */
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: ORDER_INCLUDE });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');

  const { paymentStatus } = req.body;
  if (!['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
    throw new AppError('Invalid payment status.', 400, 'INVALID_STATUS');
  }

  const paymentDetails = order.paymentDetails || {};
  if (paymentStatus === 'paid' && !paymentDetails.paidAt) {
    paymentDetails.paidAt = new Date();
  }
  if (paymentStatus === 'refunded') {
    await restockItems(order.items);
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus, paymentDetails },
    include: { ...ORDER_INCLUDE, user: USER_SELECT },
  });

  success(res, 200, { order: updated }, 'Payment status updated');
});

// ============================================================
// USER MANAGEMENT
// ============================================================

const USER_SAFE_SELECT = {
  id: true,
  fullname: true,
  email: true,
  phone: true,
  role: true,
  isBlocked: true,
  avatar: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

/** GET /api/admin/users?role=&search=&page= */
export const adminListUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;
  const { page, limit } = clampPage(req, 1, 15);

  const where = {};
  if (role && role !== 'all') where.role = role;
  if (search) {
    where.OR = [
      { fullname: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  success(res, 200, { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

/** GET /api/admin/users/:id */
export const adminGetUser = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { ...USER_SAFE_SELECT, addresses: { orderBy: { createdAt: 'desc' } } },
  });
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const [orderCount, spentAgg, recentOrders] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.aggregate({
      where: { userId: user.id, paymentStatus: 'paid' },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  success(res, 200, {
    user,
    stats: { totalOrders: orderCount, totalSpent: spentAgg._sum.total || 0 },
    recentOrders,
  });
});

/** PUT /api/admin/users/:id/role  { role } */
export const updateUserRole = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SAFE_SELECT });
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  const { role } = req.body;
  if (!['customer', 'admin'].includes(role)) {
    throw new AppError('Role must be "customer" or "admin".', 400, 'INVALID_ROLE');
  }
  if (user.id === req.user._id && role !== 'admin') {
    throw new AppError('You cannot remove your own admin role.', 400, 'SELF_ROLE');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role },
    select: USER_SAFE_SELECT,
  });
  success(res, 200, { user: updated }, 'User role updated');
});

/** PUT /api/admin/users/:id/block  { isBlocked } */
export const toggleUserBlock = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: USER_SAFE_SELECT });
  if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

  if (user.role === 'admin') {
    throw new AppError('Admin accounts cannot be blocked.', 400, 'CANNOT_BLOCK_ADMIN');
  }

  const isBlocked = Boolean(req.body.isBlocked);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isBlocked },
    select: USER_SAFE_SELECT,
  });
  success(res, 200, { user: updated }, isBlocked ? 'User blocked' : 'User unblocked');
});

// ============================================================
// EXTRA STATS
// ============================================================

/** GET /api/admin/reviews-overview (used by dashboard optionally) */
export const reviewsOverview = asyncHandler(async (_req, res) => {
  const [total, byRating, recent] = await Promise.all([
    prisma.review.count(),
    prisma.review.groupBy({
      by: ['rating'],
      _count: { _all: true },
    }),
    prisma.review.findMany({
      include: {
        user: { select: { fullname: true } },
        product: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);
  success(res, 200, {
    total,
    byRating: byRating.map((r) => ({ rating: r.rating, count: r._count._all })),
    recent,
  });
});