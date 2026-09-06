import { Router } from 'express';
import { createPaymentOrder, verifyPayment } from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.use(protect);

router.post('/create-order', (req, res, next) => {
  const { orderId } = req.body;
  if (!orderId) {
    return next(new AppError('orderId is required.', 400, 'VALIDATION_ERROR'));
  }
  return createPaymentOrder(req, res, next);
});

router.post('/verify', (req, res, next) => {
  const { orderId, razorpayPaymentId } = req.body;
  if (!orderId || !razorpayPaymentId) {
    return next(new AppError('orderId and payment details are required.', 400, 'VALIDATION_ERROR'));
  }
  return verifyPayment(req, res, next);
});

export default router;