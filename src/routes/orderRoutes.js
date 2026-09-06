import { Router } from 'express';
import { body } from 'express-validator';
import { createOrder, myOrders, getOrder, cancelOrder } from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/my-orders', myOrders);

router.post(
  '/',
  [
    body('paymentMethod').isIn(['razorpay', 'cod']).withMessage('Payment method must be razorpay or cod'),
    body('addressId').optional().isString().notEmpty().withMessage('Invalid address id'),
  ],
  validate,
  createOrder
);

router.get('/:id', getOrder);
router.put('/:id/cancel', [body('reason').optional().trim().isLength({ max: 200 })], validate, cancelOrder);

export default router;