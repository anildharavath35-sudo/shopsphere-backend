import prisma from './prisma.js';

export const connectDB = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy server/.env.example to server/.env and add your PostgreSQL connection string.'
    );
  }
  await prisma.$connect();
  console.log('[ShopSphere] PostgreSQL connected');
  return prisma;
};

export const disconnectDB = async () => {
  await prisma.$disconnect();
};