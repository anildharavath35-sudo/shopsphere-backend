import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';

/**
 * Central error handler. Everything thrown in the app lands here.
 * Customers only ever see friendly messages - never stack traces.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  let error = { ...err };
  error.message = err.message;

  // Prisma known request errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      // Unique constraint violation (email, slug, sku, cart item, ...)
      case 'P2002': {
        const meta = err.meta && err.meta.target;
        const field = Array.isArray(meta) ? meta[0] : meta || 'field';
        const humanField = field === 'email' ? 'Email' : field.charAt(0).toUpperCase() + field.slice(1);
        error = new AppError(`${humanField} is already in use.`, 409, 'DUPLICATE');
        break;
      }
      // Foreign key violation (deleting something still referenced)
      case 'P2003':
        error = new AppError('This record is still in use and cannot be deleted.', 409, 'IN_USE');
        break;
      // Record not found (via update/delete many)
      case 'P2025':
        error = new AppError('Resource not found.', 404, 'NOT_FOUND');
        break;
      // Could not convert a supplied id (invalid id format)
      case 'P2023':
        error = new AppError('Resource not found.', 404, 'NOT_FOUND');
        break;
      default:
        error = new AppError('Database operation failed.', 500, 'DB_ERROR');
    }
  }

  // Multer errors
  if (err.name === 'MulterError') {
    error =
      err.code === 'LIMIT_FILE_SIZE'
        ? new AppError('Image is too large. Max size is 5 MB.', 400, 'FILE_TOO_LARGE')
        : new AppError('Image upload failed.', 400, 'UPLOAD_ERROR');
  }

  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[ShopSphere] ❌', err);
  }

  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    error.message = 'Something went wrong on our end. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Server Error',
    code: error.code || 'SERVER_ERROR',
    details: error.details || undefined,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};