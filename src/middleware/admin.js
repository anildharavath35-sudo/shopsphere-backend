import { AppError } from '../utils/AppError.js';

/** Requires req.user to be an admin. Must run after `protect`. */
export const adminOnly = (req, _res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Admin access required.', 403, 'FORBIDDEN'));
  }
  next();
};