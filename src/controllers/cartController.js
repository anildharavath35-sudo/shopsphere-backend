import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';
import { computeOrderTotals, FREE_DELIVERY_THRESHOLD, DELIVERY_CHARGE } from '../utils/commerce.js';

const PRODUCT_INCLUDE = {
  include: {
    category: { select: { id: true, name: true, slug: true } },
  },
};

const getOrCreateCart = async (userId) => {
  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });
  return cart;
};

const getCartItems = async (cartId) =>
  prisma.cartItem.findMany({
    where: { cartId },
    include: { product: PRODUCT_INCLUDE },
    orderBy: { createdAt: 'asc' },
  });

/**
 * Builds a client-friendly cart payload.
 * - filters out deleted / inactive products
 * - caps quantities at available stock
 * - computes money summary
 */
const buildCartPayload = async (cartId) => {
  const cartItems = await getCartItems(cartId);

  const items = cartItems
    .filter((it) => it.product && it.product.isActive !== false)
    .map((it) => {
      const quantity = Math.min(it.quantity, Math.max(0, it.product.stock));
      const subtotal = it.product.price * quantity;
      const mrpTotal = it.product.mrp * quantity;
      return {
        product: it.product,
        quantity,
        subtotal,
        mrpTotal,
        discount: Math.max(0, mrpTotal - subtotal),
      };
    });

  const rawTotals = computeOrderTotals(items);

  return {
    items,
    totals: {
      ...rawTotals,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD(),
      deliveryChargeRate: DELIVERY_CHARGE(),
    },
    totalQuantity: items.reduce((sum, it) => sum + it.quantity, 0),
    itemCount: items.length,
  };
};

/** GET /api/cart */
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const payload = await buildCartPayload(cart.id);
  success(res, 200, { cart: payload });
});

/**
 * POST /api/cart  { productId, quantity }
 */
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = Math.max(1, Number(quantity) || 1);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isActive === false) {
    throw new AppError('Product not found.', 404, 'NOT_FOUND');
  }
  if (product.stock <= 0) {
    throw new AppError('This product is out of stock.', 400, 'OUT_OF_STOCK');
  }

  const cart = await getOrCreateCart(req.user._id);
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  const newQty = (existing ? existing.quantity : 0) + qty;
  if (newQty > product.stock) {
    throw new AppError(
      `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of this product are available.`,
      400,
      'STOCK_LIMIT'
    );
  }

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: newQty } });
  }

  const payload = await buildCartPayload(cart.id);
  success(res, 200, { cart: payload }, 'Added to cart');
});

/** PUT /api/cart/:productId  { quantity } */
export const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  let { quantity } = req.body;
  quantity = Number(quantity);

  const cart = await getOrCreateCart(req.user._id);
  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  if (!item) throw new AppError('Item is not in your cart.', 404, 'NOT_IN_CART');

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
  } else {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');
    if (quantity > product.stock) {
      throw new AppError(
        `Only ${product.stock} unit${product.stock === 1 ? '' : 's'} of this product are available.`,
        400,
        'STOCK_LIMIT'
      );
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  }

  const payload = await buildCartPayload(cart.id);
  success(res, 200, { cart: payload }, 'Cart updated');
});

/** DELETE /api/cart/:productId */
export const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await getOrCreateCart(req.user._id);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });

  const payload = await buildCartPayload(cart.id);
  success(res, 200, { cart: payload }, 'Item removed from cart');
});

/** DELETE /api/cart */
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  success(res, 200, { cart: emptyCartPayload() }, 'Cart cleared');
});

const emptyCartPayload = () => ({
  items: [],
  totals: { subtotal: 0, discount: 0, deliveryCharge: 0, total: 0, freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD(), deliveryChargeRate: DELIVERY_CHARGE() },
  totalQuantity: 0,
  itemCount: 0,
});

/**
 * Merges a guest cart (array of {product, quantity}) into the DB cart
 * after a user logs in / registers. Used by the auth flow.
 */
export const mergeCartForUser = async (userId, guestItems) => {
  if (!Array.isArray(guestItems) || guestItems.length === 0) return;
  const cart = await getOrCreateCart(userId);

  for (const gi of guestItems) {
    const productId = gi.product?._id || gi.productId;
    if (!productId) continue;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true, isActive: true },
    });
    if (!product || product.isActive === false || product.stock <= 0) continue;

    const quantity = Math.min(Math.max(1, Number(gi.quantity) || 1), product.stock);
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + quantity, product.stock) },
      });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
    }
  }
};