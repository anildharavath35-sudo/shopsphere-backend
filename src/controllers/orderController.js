import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';
import { computeOrderTotals } from '../utils/commerce.js';
import { ORDER_CANCELABLE_STATUSES } from '../utils/constants.js';

const ORDER_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  statusHistory: { orderBy: { at: 'asc' } },
};

const USER_SELECT = { select: { fullname: true, email: true, phone: true } };

const generateOrderId = () => {
  const seq = Math.floor(100000 + Math.random() * 900000).toString();
  const date = new Date().toISOString().replace(/\D/g, '').slice(0, 8);
  return 'SP' + date + seq;
};

/**
 * POST /api/orders
 * Body: { address: {...} | addressId, paymentMethod: 'razorpay'|'cod' }
 * The order is created from the user's database cart and stock is reserved.
 * Totals are always recomputed server-side (client totals are never trusted).
 */
export const createOrder = asyncHandler(async (req, res) => {
  const { address: addressBody, addressId, paymentMethod } = req.body;

  if (!['razorpay', 'cod'].includes(paymentMethod)) {
    throw new AppError('Please choose a valid payment method.', 400, 'INVALID_PAYMENT_METHOD');
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: req.user._id },
    include: { items: { include: { product: true } } },
  });
  const validItems = (cart?.items || []).filter((it) => it.product);
  if (validItems.length === 0) {
    throw new AppError('Your cart is empty. Add products before checking out.', 400, 'EMPTY_CART');
  }

  // --- Resolve shipping address ---
  let shippingAddress;
  if (addressId) {
    const saved = await prisma.address.findFirst({
      where: { id: addressId, userId: req.user._id },
    });
    if (!saved) throw new AppError('Shipping address not found.', 404, 'ADDRESS_NOT_FOUND');
    shippingAddress = {
      fullname: saved.fullname,
      phone: saved.phone,
      address: saved.address,
      apartment: saved.apartment,
      city: saved.city,
      state: saved.state,
      postalCode: saved.postalCode,
      country: saved.country,
    };
  } else if (addressBody) {
    shippingAddress = addressBody;
  }

  const requiredAddressFields = ['fullname', 'phone', 'address', 'city', 'state', 'postalCode'];
  for (const f of requiredAddressFields) {
    if (!shippingAddress?.[f]?.trim()) {
      throw new AppError(
        `Shipping address is incomplete — ${f.replace(/([A-Z])/g, ' $1').toLowerCase()} is required.`,
        400,
        'INVALID_ADDRESS'
      );
    }
  }

  // --- Build order items + reserve stock (atomically) ---
  const items = [];
  for (const it of validItems) {
    const product = it.product;
    if (product.isActive === false) continue;
    if (product.stock < it.quantity) {
      throw new AppError(
        `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of "${product.name}" are available.`,
        400,
        'STOCK_LIMIT'
      );
    }

    const reserved = await prisma.product.updateMany({
      where: { id: product.id, stock: { gte: it.quantity } },
      data: { stock: { decrement: it.quantity } },
    });
    if (reserved.count === 0) {
      throw new AppError(`"${product.name}" is out of stock.`, 400, 'OUT_OF_STOCK');
    }

    const subtotal = product.price * it.quantity;
    items.push({
      productId: product.id,
      name: product.name,
      image: product.thumbnail || product.images?.[0] || '',
      brand: product.brand,
      price: product.price,
      mrp: product.mrp,
      quantity: it.quantity,
      subtotal,
    });
  }

  if (items.length === 0) {
    throw new AppError('Your cart has no orderable items.', 400, 'EMPTY_CART');
  }

  const totals = computeOrderTotals(items);

  // COD orders are confirmed immediately; Razorpay orders wait for payment.
  const isCod = paymentMethod === 'cod';
  const statusHistory = isCod
    ? [
        { status: 'pending', note: 'Order placed' },
        { status: 'confirmed', note: 'Order confirmed' },
      ]
    : [{ status: 'pending', note: 'Order placed' }];

  const order = await prisma.order.create({
    data: {
      orderId: generateOrderId(),
      userId: req.user._id,
      shippingAddress,
      paymentMethod,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryCharge: totals.deliveryCharge,
      total: totals.total,
      orderStatus: isCod ? 'confirmed' : 'pending',
      statusHistory: { create: statusHistory },
      items: { create: items },
    },
    include: ORDER_INCLUDE,
  });

  // Clear the user's cart now that the order exists.
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  success(res, 201, { order }, 'Order placed successfully');
});

/** GET /api/orders/my-orders */
export const myOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user._id },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  success(res, 200, { orders });
});

/** GET /api/orders/:id  (customer: own order, admin: any) */
export const getOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { ...ORDER_INCLUDE, user: USER_SELECT },
  });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && order.userId !== req.user._id) {
    throw new AppError('You are not allowed to view this order.', 403, 'FORBIDDEN');
  }
  success(res, 200, { order });
});

/**
 * PUT /api/orders/:id/cancel
 * Cancellation is allowed for pending/confirmed/processing orders.
 * Reserved stock is returned to inventory.
 */
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new AppError('Order not found.', 404, 'NOT_FOUND');
  if (order.userId !== req.user._id) {
    throw new AppError('You are not allowed to cancel this order.', 403, 'FORBIDDEN');
  }
  if (!ORDER_CANCELABLE_STATUSES.includes(order.orderStatus)) {
    throw new AppError(
      `Order cannot be cancelled in its current state ("${order.orderStatus}").`,
      400,
      'NOT_CANCELLABLE'
    );
  }

  await restockItems(order.items);

  const cancellationReason = req.body.reason || 'Cancelled by customer';
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      orderStatus: 'cancelled',
      cancellable: false,
      cancellationReason,
      statusHistory: { create: [{ status: 'cancelled', note: cancellationReason }] },
    },
    include: ORDER_INCLUDE,
  });

  success(res, 200, { order: updated }, 'Order cancelled');
});

/**
 * GET /api/orders/:id/track
 * Same data as getOrder; kept for clarity of the tracking page.
 */
export const trackOrder = getOrder;

/** Returns reserved stock for the given order items. */
export const restockItems = async (items) => {
  for (const it of items) {
    if (!it.productId) continue;
    await prisma.product.update({
      where: { id: it.productId },
      data: { stock: { increment: it.quantity } },
    });
  }
};