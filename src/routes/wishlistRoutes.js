import { Router } from 'express';
import { body } from 'express-validator';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/', getWishlist);
router.post('/', [body('productId').notEmpty().withMessage('productId is required')], validate, addToWishlist);
router.post('/:productId/move-to-cart', moveToCart);
router.delete('/:productId', removeFromWishlist);

export default router;