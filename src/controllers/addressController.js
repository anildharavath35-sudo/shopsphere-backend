import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';

const ORDER_ADDRESSES = [{ isDefault: 'desc' }, { createdAt: 'desc' }];

/** GET /api/addresses */
export const getAddresses = asyncHandler(async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user._id },
    orderBy: ORDER_ADDRESSES,
  });
  success(res, 200, { addresses });
});

/** POST /api/addresses */
export const createAddress = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const data = { ...req.body };

  const count = await prisma.address.count({ where: { userId } });
  if (req.body.isDefault) {
    await prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    data.isDefault = true;
  } else {
    data.isDefault = count === 0;
  }

  const address = await prisma.address.create({ data: { ...data, userId } });
  success(res, 201, { address }, 'Address saved');
});

/** PUT /api/addresses/:id */
export const updateAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const address = await prisma.address.findFirst({ where: { id, userId: req.user._id } });
  if (!address) throw new AppError('Address not found.', 404, 'NOT_FOUND');

  const data = { ...req.body };
  delete data.id;
  delete data.userId;
  delete data.createdAt;
  delete data.updatedAt;

  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user._id, id: { not: address.id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.address.update({ where: { id: address.id }, data });
  success(res, 200, { address: updated }, 'Address updated');
});

/** DELETE /api/addresses/:id */
export const deleteAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const address = await prisma.address.findFirst({ where: { id, userId: req.user._id } });
  if (!address) throw new AppError('Address not found.', 404, 'NOT_FOUND');

  await prisma.address.delete({ where: { id: address.id } });
  success(res, 200, null, 'Address deleted');
});