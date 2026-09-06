import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';

const PRODUCT_INCLUDE = {
  include: {
    category: { select: { id: true, name: true, slug: true } },
  },
};

const getOrCreateWishlist = async (userId) => {
  let wishlist = await prisma.wishlist.findUnique({ where: { userId } });
  if (!wishlist) wishlist = await prisma.wishlist.create({ data: { userId } });
  return wishlist;
};

const getWishlistProducts = async (wishlistId) => {
  const entries = await prisma.wishlistProduct.findMany({
    where: { wishlistId },
    include: { product: PRODUCT_INCLUDE },
    orderBy: { createdAt: 'desc' },
  });
  return entries
    .map((e) => e.product)
    .filter((p) => p && p.isActive !== false);
};

/** GET /api/wishlist */
export const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user._id);
  const products = await getWishlistProducts(wishlist.id);
  success(res, 200, { wishlist: { products } });
});

/** POST /api/wishlist  { productId } */
export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  const wishlist = await getOrCreateWishlist(req.user._id);
  const existing = await prisma.wishlistProduct.findUnique({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
  });
  if (!existing) {
    await prisma.wishlistProduct.create({ data: { wishlistId: wishlist.id, productId } });
  }

  const products = await getWishlistProducts(wishlist.id);
  success(res, 200, { wishlist: { products } }, 'Added to wishlist');
});

/** DELETE /api/wishlist/:productId */
export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const wishlist = await getOrCreateWishlist(req.user._id);
  await prisma.wishlistProduct.deleteMany({ where: { wishlistId: wishlist.id, productId } });

  const products = await getWishlistProducts(wishlist.id);
  success(res, 200, { wishlist: { products } }, 'Removed from wishlist');
});

/**
 * POST /api/wishlist/:productId/move-to-cart  { quantity }
 * Convenience: adds item to cart and removes it from the wishlist.
 */
export const moveToCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const quantity = Math.max(1, Number(req.body.quantity) || 1);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isActive === false) {
    throw new AppError('Product not found.', 404, 'NOT_FOUND');
  }
  if (product.stock <= 0) throw new AppError('This product is out of stock.', 400, 'OUT_OF_STOCK');

  let cart = await prisma.cart.findUnique({ where: { userId: req.user._id } });
  if (!cart) cart = await prisma.cart.create({ data: { userId: req.user._id } });

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  const newQty = (existing ? existing.quantity : 0) + quantity;
  if (newQty > product.stock) {
    throw new AppError(`Only ${product.stock} unit${product.stock === 1 ? '' : 's'} available.`, 400, 'STOCK_LIMIT');
  }
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity: newQty } });
  }

  const wishlist = await getOrCreateWishlist(req.user._id);
  await prisma.wishlistProduct.deleteMany({ where: { wishlistId: wishlist.id, productId } });

  success(res, 200, null, 'Moved to cart');
});