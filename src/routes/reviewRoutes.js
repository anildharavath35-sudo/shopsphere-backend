import { Router } from 'express';
import { getProductReviews, updateReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { body } from 'express-validator';

const router = Router();

// GET /api/reviews/product/:productId  (pageable product reviews)
router.get('/product/:productId', getProductReviews);

router.put(
  '/:id',
  protect,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional().trim().isLength({ max: 1000 }),
  ],
  validate,
  updateReview
);

router.delete('/:id', protect, deleteReview);

export default router;