import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import { signToken } from '../utils/jwt.js';
import prisma from '../config/prisma.js';

const sendAuthResponse = (res, user, statusCode = 200) => {
  const token = signToken(user.id);
  success(res, statusCode, { user, token }, 'Authenticated successfully');
};

/**
 * POST /api/auth/register
 * Fields: fullname, email, phone, password
 */
export const register = asyncHandler(async (req, res) => {
  const { fullname, email, phone, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new AppError('An account with this email already exists. Please log in.', 409, 'EMAIL_IN_USE');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { fullname, email: normalizedEmail, phone, password: hashedPassword },
  });

  if (req.body.mergeCart) {
    const mergeCartHandler = await import('./cartController.js').then((m) => m.mergeCartForUser);
    await mergeCartHandler(user.id, req.body.mergeCart);
  }

  sendAuthResponse(res, user, 201);
});

/**
 * POST /api/auth/login
 * Fields: email, password
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.isBlocked) {
    throw new AppError('Your account has been blocked. Contact support.', 403, 'ACCOUNT_BLOCKED');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  user.lastLoginAt = new Date();

  sendAuthResponse(res, user);
});

/**
 * GET /api/auth/me
 */
export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user._id },
    include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] } },
  });
  success(res, 200, { user }, 'Profile fetched');
});

/**
 * PUT /api/auth/profile
 * Update name/phone (and email with uniqueness check).
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { fullname, email, phone, avatar } = req.body;

  const current = await prisma.user.findUnique({ where: { id: req.user._id } });

  const data = {};
  if (email && email.toLowerCase() !== current.email) {
    const taken = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (taken) throw new AppError('This email is already in use.', 409, 'EMAIL_IN_USE');
    data.email = email.toLowerCase();
  }
  if (fullname) data.fullname = fullname;
  if (phone) data.phone = phone;
  if (avatar !== undefined) data.avatar = avatar;

  const user = await prisma.user.update({ where: { id: req.user._id }, data });
  success(res, 200, { user }, 'Profile updated');
});

/**
 * PUT /api/auth/change-password
 * Fields: currentPassword, newPassword
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user._id } });
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new AppError('Current password is incorrect.', 401, 'WRONG_PASSWORD');
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    throw new AppError('New password must be different from the current password.', 400, 'SAME_PASSWORD');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });

  const token = signToken(user.id);
  success(res, 200, { token }, 'Password changed successfully. Please log in again.');
});

/**
 * POST /api/auth/verify-password (used before destructive actions)
 */
export const verifyPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user._id } });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError('Incorrect password.', 401, 'WRONG_PASSWORD');
  success(res, 200, { ok: true }, 'Password verified');
});