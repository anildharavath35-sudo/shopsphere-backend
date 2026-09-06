import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from '../controllers/cartController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/', getCart);
router.post(
  '/',
  [
    body('productId').notEmpty().withMessage('productId is required'),
    body('quantity').optional().isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99'),
  ],
  validate,
  addToCart
);
router.put(
  '/:productId',
  [body('quantity').isInt({ min: 1, max: 99 }).withMessage('Quantity must be between 1 and 99')],
  validate,
  updateCartItem
);
router.delete('/:productId', removeFromCart);
router.delete('/', clearCart);

export default router;