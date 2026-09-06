import { Router } from 'express';
import { uploadImages } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/admin.js';
import { uploadImages as uploadMiddleware } from '../middleware/upload.js';

const router = Router();

router.post('/images', protect, adminOnly, uploadMiddleware.array('images', 8), uploadImages);

export default router;