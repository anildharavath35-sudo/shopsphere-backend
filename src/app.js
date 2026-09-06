import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import { cloudinaryConfig } from './config/cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Deferred (non-blocking) Cloudinary setup
try {
  cloudinaryConfig();
} catch {
  /* Cloudinary is optional - enabled only when env vars are present */
}

app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

// 404 for unknown API routes
app.use('/api', (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Serve built React frontend in production ONLY when the build exists.
// - Monorepo-style deploy: server/ and client/ are siblings -> client/dist served,
//   and GET / returns index.html (SPA falls through to React Router).
// - Standalone API deploy (e.g. Render hosting server/ only, frontend on Vercel):
//   client/dist is absent, so this block is skipped and the server stays API-only.
const clientDist = join(__dirname, '../../client/dist');
const clientIndex = join(clientDist, 'index.html');
if (process.env.NODE_ENV === 'production' && existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(clientIndex);
  });
}

app.use(errorHandler);

export default app;