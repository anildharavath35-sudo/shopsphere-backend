import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`[ShopSphere] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });

    process.on('unhandledRejection', (err) => {
      console.error('[ShopSphere] Unhandled rejection:', err.message);
      server.close(() => process.exit(1));
    });
  } catch (err) {
    console.error('[ShopSphere] Failed to start server:', err.message);
    process.exit(1);
  }
};

start();