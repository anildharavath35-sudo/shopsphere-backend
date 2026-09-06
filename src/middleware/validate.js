import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

/**
 * Runs express-validator checks declared in the route.
 * Collects every error and returns a single 400 response.
 */
export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const details = errors.array().map((e) => ({ field: e.path, message: e.msg }));
  const message = details.map((d) => d.message).join(' ');
  throw new AppError(message, 400, 'VALIDATION_ERROR', details);
};