import { Router } from 'express';
import { body } from 'express-validator';
import { getAddresses, createAddress, updateAddress, deleteAddress } from '../controllers/addressController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/', getAddresses);

router.post(
  '/',
  [
    body('fullname').trim().notEmpty().withMessage('Full name is required'),
    body('phone').matches(/^[0-9+\-\s()]{10,15}$/).withMessage('Please provide a valid phone number'),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('postalCode').trim().notEmpty().withMessage('Postal code is required'),
  ],
  validate,
  createAddress
);

router.put(
  '/:id',
  [
    body('fullname').optional().trim().notEmpty(),
    body('phone').optional().matches(/^[0-9+\-\s()]{10,15}$/),
    body('city').optional().trim().notEmpty(),
    body('state').optional().trim().notEmpty(),
    body('postalCode').optional().trim().notEmpty(),
  ],
  validate,
  updateAddress
);

router.delete('/:id', deleteAddress);

export default router;