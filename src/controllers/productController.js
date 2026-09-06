import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import prisma from '../config/prisma.js';
import { uploadToCloudinary } from '../services/imageService.js';

const PAGE_SIZE = 12;

const CATEGORY_INCLUDE = { select: { id: true, name: true, slug: true } };

const SORT_MAP = {
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  newest: { createdAt: 'desc' },
  rating: [{ rating: 'desc' }, { numReviews: 'desc' }],
  popularity: [{ soldCount: 'desc' }, { views: 'desc' }],
  name_asc: { name: 'asc' },
  default: { createdAt: 'desc' },
};

const buildFilter = (query) => {
  const where = { isActive: true };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { brand: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.category) {
    where.categoryId = query.category;
  }

  if (query.brand) {
    const brands = Array.isArray(query.brand) ? query.brand : query.brand.split(',');
    where.brand = { in: brands };
  }

  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = Number(query.minPrice);
    if (query.maxPrice) where.price.lte = Number(query.maxPrice);
  }

  if (query.minRating) {
    where.rating = { gte: Number(query.minRating) };
  }

  if (query.inStock === 'true' || query.inStock === '1') {
    where.stock = { gt: 0 };
  }

  if (query.featured === 'true') where.featured = true;
  if (query.bestseller === 'true') where.bestseller = true;

  return where;
};

const mapPagination = (query, total) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(48, Number(query.limit) || PAGE_SIZE);
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
};

/**
 * GET /api/products
 * Supports search, category, brand, price range, rating, availability,
 * sorting and pagination.
 */
export const getProducts = asyncHandler(async (req, res) => {
  const where = buildFilter(req.query);
  const orderBy = SORT_MAP[req.query.sort] || SORT_MAP.default;
  const { page, limit } = mapPagination(req.query);

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: { category: CATEGORY_INCLUDE },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  success(res, 200, {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    brands: [...new Set(products.map((p) => p.brand))],
    filters: { brands: [...new Set(products.map((p) => p.brand))] },
  });
});

const findProductByIdOrSlug = async (id, include) => {
  let product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include,
  });
  if (!product) {
    product = await prisma.product.findFirst({
      where: { slug: id, isActive: true },
      include,
    });
  }
  return product;
};

/**
 * GET /api/products/:id
 * id may be a row id or a slug.
 */
export const getProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const product = await findProductByIdOrSlug(id, { category: CATEGORY_INCLUDE });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  await prisma.product.update({ where: { id: product.id }, data: { views: { increment: 1 } } });

  const related = await prisma.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, isActive: true },
    include: { category: CATEGORY_INCLUDE },
    orderBy: { soldCount: 'desc' },
    take: 4,
  });

  success(res, 200, { product, related });
});

// ---------------- Admin product management ----------------

/**
 * POST /api/products  (admin)
 */
export const createProduct = asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.body.category } });
  if (!category) throw new AppError('Selected category does not exist.', 400, 'INVALID_CATEGORY');

  const data = { ...req.body };
  if (data.mrp !== undefined) data.mrp = Number(data.mrp);
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.stock !== undefined) data.stock = Number(data.stock);
  if (data.specifications && typeof data.specifications === 'string') {
    try {
      data.specifications = JSON.parse(data.specifications);
    } catch {
      throw new AppError('Specifications must be valid JSON.', 400, 'INVALID_SPECS');
    }
  }

  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const { category: _category, ...fields } = data;
  if (!fields.sku || !String(fields.sku).trim()) {
    fields.sku = `${fields.brand || 'PRD'}-${slug.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const product = await prisma.product.create({
    data: { ...fields, categoryId: category.id, slug },
    include: { category: CATEGORY_INCLUDE },
  });
  success(res, 201, { product }, 'Product created');
});

/**
 * PUT /api/products/:id  (admin)
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  const data = { ...req.body };
  for (const key of ['mrp', 'price', 'stock']) {
    if (data[key] !== undefined) data[key] = Number(data[key]);
  }
  if (data.specifications && typeof data.specifications === 'string') {
    try {
      data.specifications = JSON.parse(data.specifications);
    } catch {
      throw new AppError('Specifications must be valid JSON.', 400, 'INVALID_SPECS');
    }
  }
  // blocks slug/timestamps tampering
  delete data.id;
  delete data._id;
  delete data.slug;
  delete data.createdAt;
  delete data.updatedAt;

  if (data.category) {
    const category = await prisma.category.findUnique({ where: { id: data.category } });
    if (!category) throw new AppError('Selected category does not exist.', 400, 'INVALID_CATEGORY');
    data.categoryId = data.category;
  }
  delete data.category;

  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data,
    include: { category: CATEGORY_INCLUDE },
  });

  success(res, 200, { product: updated }, 'Product updated');
});

/**
 * DELETE /api/products/:id  (admin)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  await prisma.product.delete({ where: { id: product.id } });
  success(res, 200, null, 'Product deleted');
});

/**
 * POST /api/products/:id/images  (admin)
 * Uploads 1..N images to Cloudinary and appends to product.images.
 */
export const uploadProductImages = asyncHandler(async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new AppError('Product not found.', 404, 'NOT_FOUND');

  if (!req.files || req.files.length === 0) {
    throw new AppError('Please provide at least one image file.', 400, 'NO_FILE');
  }

  const folder = `shopsphere/products/${product.slug || product.id}`;
  const urls = [];
  for (const file of req.files) {
    const url = await uploadToCloudinary(file.buffer, folder);
    urls.push(url);
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      images: { push: urls },
      ...(product.thumbnail ? {} : { thumbnail: urls[0] }),
    },
    include: { category: CATEGORY_INCLUDE },
  });

  success(res, 200, { product: updated, urls }, 'Images uploaded');
});