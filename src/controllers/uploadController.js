import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import { uploadToCloudinary } from '../services/imageService.js';

/**
 * POST /api/upload/images  (admin)
 * Generic single/multi image upload -> Cloudinary URLs.
 */
export const uploadImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('Please attach at least one image.', 400, 'NO_FILE');
  }

  const folder = req.body.folder || 'shopsphere';
  const urls = [];
  for (const file of req.files) {
    urls.push(await uploadToCloudinary(file.buffer, folder));
  }

  success(res, 200, { urls }, 'Images uploaded');
});