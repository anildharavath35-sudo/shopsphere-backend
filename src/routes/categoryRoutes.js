import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCategories,
  getAllCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';
import { validate } from '../middleware/validate.js';
import { uploadImages } from '../middleware/upload.js';
import { uploadToCloudinary } from '../services/imageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import prisma from '../config/prisma.js';
import { success } from '../utils/response.js';

const router = Router();

router.get('/', getCategories);

// Admin
router.get('/all', protect, adminOnly, getAllCategoriesAdmin);

router.post(
  '/',
  protect,
  adminOnly,
  [body('name').trim().notEmpty().withMessage('Category name is required')],
  validate,
  createCategory
);

// Upload an image for a category banner/thumbnail
router.post(
  '/:id/image',
  protect,
  adminOnly,
  uploadImages.single('image'),
  asyncHandler(async (req, res) => {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');
    if (!req.file) throw new AppError('Please attach an image.', 400, 'NO_FILE');
    const url = await uploadToCloudinary(req.file.buffer, 'shopsphere/categories');
    const updated = await prisma.category.update({ where: { id: category.id }, data: { image: url } });
    success(res, 200, { category: updated }, 'Category image updated');
  })
);

router.put('/:id', protect, adminOnly, updateCategory);
router.delete('/:id', protect, adminOnly, deleteCategory);

export default router;