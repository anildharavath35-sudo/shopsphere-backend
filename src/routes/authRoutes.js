import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, me, updateProfile, changePassword, verifyPassword } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';

const router = Router();

const PASSWORD_RULE = {
  minLength: 8,
  msg: 'Password must be at least 8 characters with at least one number and one special character',
  regex: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/,
};

router.post(
  '/register',
  [
    body('fullname').trim().notEmpty().withMessage('Full name is required').isLength({ max: 80 }),
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('phone').matches(/^[0-9+\-\s()]{10,15}$/).withMessage('Please provide a valid phone number'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(PASSWORD_RULE.regex)
      .withMessage('Password must contain letters, at least one number and one special character'),
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.get('/me', protect, me);

router.put(
  '/profile',
  protect,
  [
    body('fullname').optional().trim().notEmpty().withMessage('Full name cannot be empty').isLength({ max: 80 }),
    body('email').optional().isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
    body('phone').optional().matches(/^[0-9+\-\s()]{10,15}$/).withMessage('Please provide a valid phone number'),
  ],
  validate,
  updateProfile
);

router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(PASSWORD_RULE.regex)
      .withMessage('New password must contain letters, at least one number and one special character'),
  ],
  validate,
  changePassword
);

router.post(
  '/verify-password',
  protect,
  [body('password').notEmpty().withMessage('Password is required')],
  validate,
  verifyPassword
);

export default router;