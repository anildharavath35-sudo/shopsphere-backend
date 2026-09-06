import { Router } from 'express';
import {
  getDashboard,
  adminListOrders,
  adminGetOrder,
  updateOrderStatus,
  updatePaymentStatus,
  adminListUsers,
  adminGetUser,
  updateUserRole,
  toggleUserBlock,
  reviewsOverview,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';

const router = Router();

router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', getDashboard);

// Orders
router.get('/orders', adminListOrders);
router.get('/orders/:id', adminGetOrder);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/payment', updatePaymentStatus);

// Users
router.get('/users', adminListUsers);
router.get('/users/:id', adminGetUser);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/block', toggleUserBlock);

// Extras
router.get('/reviews-overview', reviewsOverview);

export default router;