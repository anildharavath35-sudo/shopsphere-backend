import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';
import { toClient } from '../utils/serialize.js';
import prisma from '../config/prisma.js';

/**
 * Guards routes behind a valid JWT.
 * Attaches req.user (freshly loaded from DB, safe client shape: `_id`, no password).
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new AppError('You are not logged in. Please log in to continue.', 401, 'UNAUTHORIZED');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Session expired. Please log in again.', 401, 'SESSION_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
    }
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    throw new AppError('This account no longer exists.', 401, 'UNAUTHORIZED');
  }
  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Contact support.', 403, 'ACCOUNT_BLOCKED');
  }

  req.user = toClient(user);
  next();
});