import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const getCategories = asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });
  success(res, 200, { categories });
});

export const getAllCategoriesAdmin = asyncHandler(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  success(res, 200, { categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, image, order } = req.body;
  const category = await prisma.category.create({
    data: {
      name,
      slug: slugify(name),
      description: description || '',
      image: image || '',
      order: Number(order) || 0,
    },
  });
  success(res, 201, { category }, 'Category created');
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');

  const data = { ...req.body };
  delete data.id;
  delete data.slug;
  delete data.createdAt;
  delete data.updatedAt;
  if (req.body.name) data.slug = slugify(req.body.name);

  const updated = await prisma.category.update({ where: { id: category.id }, data });
  success(res, 200, { category: updated }, 'Category updated');
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!category) throw new AppError('Category not found.', 404, 'NOT_FOUND');

  await prisma.category.delete({ where: { id: category.id } });
  success(res, 200, null, 'Category deleted');
});