import { isCloudinaryConfigured } from '../config/cloudinary.js';
import cloudinary from '../config/cloudinary.js';

/**
 * Uploads a single image buffer to Cloudinary.
 * @param {Buffer} buffer - image bytes (from multer memory storage)
 * @param {string} folder - cloudinary folder name
 * @param {string|null} publicId - optional public id to overwrite
 * @returns {Promise<string>} secure URL
 */
export const uploadToCloudinary = async (buffer, folder = 'shopsphere', publicId = null) => {
  if (!isCloudinaryConfigured()) {
    const msg =
      'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET to server/.env.';
    const err = new Error(msg);
    err.code = 'CLOUDINARY_NOT_CONFIGURED';
    throw err;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId || undefined,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured() || !publicId) return;
  return cloudinary.uploader.destroy(publicId);
};