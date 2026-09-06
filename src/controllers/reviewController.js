import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';

const PAGE_SIZE = 6;

const USER_SELECT = { select: { fullname: true, avatar: true } };

const recomputeProductRating = async (productId) => {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      numReviews: agg._count._all,
    },
  });
};

/** GET /api/products/:productId/reviews?page= */
export const getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const page = Math.max(1, Number(req.query.page) || 1);

  const [total, reviews] = await prisma.$transaction([
    prisma.review.count({ where: { productId } }),
    prisma.review.findMany({
      where: { productId },
      include: { user: USER_SELECT },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  success(res, 200, { reviews, pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } });
});

/**
 * POST /api/products/:productId/reviews
 * Only customers who actually purchased the product (non-cancelled order)
 * may review it. One review per user per product.
 */
export const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { rating, title, comment } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  const purchased = await prisma.order.count({
    where: {
      userId: req.user._id,
      orderStatus: { not: 'cancelled' },
      items: { some: { productId } },
    },
  });
  if (!purchased) {
    throw new AppError(
      'You can review a product only after you have purchased it.',
      403,
      'PURCHASE_REQUIRED'
    );
  }

  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId: req.user._id, productId } },
  });
  if (existing) {
    throw new AppError('You have already reviewed this product. You can edit your existing review.', 409, 'ALREADY_REVIEWED');
  }

  const review = await prisma.review.create({
    data: {
      userId: req.user._id,
      productId,
      rating: Number(rating),
      title: title || '',
      comment,
    },
    include: { user: USER_SELECT },
  });

  await recomputeProductRating(productId);
  success(res, 201, { review }, 'Review submitted');
});

/** PUT /api/reviews/:id  (owner only) */
export const updateReview = asyncHandler(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) throw new AppError('Review not found.', 404, 'NOT_FOUND');
  if (review.userId !== req.user._id) {
    throw new AppError('You can only edit your own reviews.', 403, 'FORBIDDEN');
  }

  const data = {
    rating: req.body.rating !== undefined ? Number(req.body.rating) : review.rating,
    title: req.body.title !== undefined ? req.body.title : review.title,
    comment: req.body.comment !== undefined ? req.body.comment : review.comment,
  };
  const updated = await prisma.review.update({ where: { id: review.id }, data });

  await recomputeProductRating(review.productId);
  success(res, 200, { review: updated }, 'Review updated');
});

/** DELETE /api/reviews/:id  (owner only) */
export const deleteReview = asyncHandler(async (req, res) => {
  const review = await prisma.review.findUnique({ where: { id: req.params.id } });
  if (!review) throw new AppError('Review not found.', 404, 'NOT_FOUND');
  if (review.userId !== req.user._id) {
    throw new AppError('You can only delete your own reviews.', 403, 'FORBIDDEN');
  }

  const productId = review.productId;
  await prisma.review.delete({ where: { id: review.id } });
  await recomputeProductRating(productId);
  success(res, 200, null, 'Review deleted');
});