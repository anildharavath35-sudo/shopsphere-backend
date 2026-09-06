import multer from 'multer';
import { AppError } from '../utils/AppError.js';

// In-memory storage; we hand the buffer to Cloudinary.
const storage = multer.memoryStorage();

const ALLOWED = /image\/(jpeg|png|jpg|webp|gif|avif)/;

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.mimetype)) {
      return cb(new AppError('Only image files (jpg, png, webp, gif) are allowed.', 400, 'INVALID_IMAGE'));
    }
    cb(null, true);
  },
});