# ShopSphere Backend

Express + Prisma + PostgreSQL REST API for ShopSphere.

## Getting started

```bash
npm install
npx prisma generate          # generate Prisma Client
npx prisma migrate dev       # apply migrations (local dev)
npm run seed:reset           # optional: seed demo data
npm run dev                  # nodemon on :5000
```

## Environment variables (`.env`)

Copy `.env.example` to `.env` (see file for full list). Essentials:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — strong random string
- `NODE_ENV` — `development` or `production`
- `PORT` — defaults to `5000`
- `PAYMENT_DEV_MODE` — `true` skips Razorpay (dev); set `false` and add `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` for real payments
- `CLIENT_URL` — allowed CORS origin (your Vercel frontend URL)

## Deploying to Render (Web Service)

1. Create a **PostgreSQL** instance on Render and copy its internal connection string.
2. Create a **Web Service** from this repo:
   - Build: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start: `npm run start`
3. Set env vars: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_URL=<your vercel url>`, plus Razorpay keys if required.
