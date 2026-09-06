import { PrismaClient } from '@prisma/client';

/**
 * Single Prisma client instance shared across the app.
 * (For a bigger API you would scale this, but for ShopSphere one client
 *  in dev is the right trade-off.)
 */
const prisma = new PrismaClient();

export default prisma;