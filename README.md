# Veggie Shop

Kenyan KES storefront built with static HTML/CSS/JavaScript, Node.js, Express, and SQLite for local development.

## Deployment Status

**Not ready for production deployment to Vercel.** The current app writes users, products, and orders to `veggie-shop/shop.db`, which is tracked in Git and is not a durable, shared database for Vercel Functions. The Express app also uses `express.static()` for files that Vercel requires under `public/`.

Do not deploy the tracked database or use it as production storage. The repository database currently contains user and order records. Review repository access/history and remove the database from source control using an approved, backed-up cleanup process before deployment.

## Features

- Product browsing, filtering, sorting, and cart management.
- Customer signup/login, order history, and order tracking.
- Admin dashboard at `/admin.html` with server-enforced admin authorization.
- KES order capture with server-calculated product prices.
- Online payment is intentionally disabled. Paypack KES compatibility is unconfirmed; `/api/pay` returns `503`, and orders remain `Pending Payment` until a KES-compatible provider is integrated and settlement is independently verified.

## Stack

- Node.js and Express 5 API.
- SQLite (`shop.db`) for local development only.
- Static frontend with vanilla JavaScript and CSS.
- Bcrypt password hashing, JWT bearer authentication, Helmet, CORS allowlisting, and rate limiting.
- Nodemailer is optional and requires SMTP environment variables.

## Local Development

Use Node.js and npm from the application directory:

```powershell
cd .\veggie-shop
npm install
Copy-Item .env.example .env
npm start
```

Open `http://localhost:3000` for the storefront or `http://localhost:3000/admin.html` for the admin portal. Do not open the HTML files directly; the app uses same-origin API routes. Configure local `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `.env`. Never commit `.env`.

Run the payment-safety tests with:

```powershell
npm test
```

The tests use an isolated temporary SQLite database and do not contact Paypack.

## API Overview

| Method | Endpoint | Access |
| --- | --- | --- |
| `GET` | `/api/products` | Public |
| `POST` | `/api/auth/signup` | Public, rate limited |
| `POST` | `/api/auth/login` | Public, rate limited |
| `GET` | `/api/user/profile` | Authenticated customer |
| `PATCH` | `/api/user/profile` | Authenticated customer |
| `POST` | `/api/orders` | Guest or authenticated customer; prices calculated server-side |
| `GET` | `/api/orders/track` | Public order ID/email lookup |
| `POST` | `/api/pay` | Disabled; returns `503` |
| `GET` | `/api/admin/me` | Authenticated admin |
| `GET` | `/api/admin/orders` | Authenticated admin |
| `POST` | `/api/admin/products` | Authenticated admin |
| `PATCH` | `/api/admin/products/:id` | Authenticated admin |
| `PATCH` | `/api/admin/orders/:id/status` | Authenticated admin; fulfillment is blocked until payment can be verified |

## Vercel Readiness Work

1. Move production persistence to hosted PostgreSQL. Vercel Postgres is no longer offered for new projects; Vercel Marketplace provides providers such as Neon and Supabase. The SQLite schema, queries, startup migrations, and seed behavior must be adapted. No migration has been performed.
2. Keep SQLite for local development only. Move one-time schema migration/admin provisioning out of per-instance startup.
3. Configure Vercel’s **Root Directory** as `veggie-shop`; the Git root is only a container for the app and does not contain its `package.json`.
4. Place the frontend and static assets in `public/` while preserving paths. Vercel’s Express deployment does not serve assets through `express.static()`.
5. Stop tracking `shop.db` and `node_modules`, commit the ignore rules, and review the database’s Git history before making the repository public or deploying it.
6. Fix HTML output escaping, use a production-appropriate CSP, and use shared rate limiting before handling public production traffic.

Vercel currently detects an Express `server.js` entry point and supports an `app.listen()` server. A `vercel.json` is not required for that basic Express setup when the project root is configured correctly. This does not make local SQLite or the existing static-file layout production-compatible.

## Vercel Environment Variables

For the current server code, configure these in Vercel’s Production and Preview environments:

- `JWT_SECRET` (32+ characters)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (needed by current startup provisioning; provisioning should be refactored to a one-time process)
- `ALLOWED_ORIGINS` (Vercel production and preview origins)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` only if SMTP is enabled
- `JWT_EXPIRES` only if overriding the default

After the database refactor, configure the provider’s database connection variable (for example, `DATABASE_URL`) and update the app to use it. The current code does not read `DATABASE_URL`; `DATABASE_PATH` is only a local SQLite path. Do not configure Paypack keys for this KES store. Vercel supplies `PORT` and its deployment environment; do not copy local `.env` values into production.

## Project Files

```text
veggie-shop/
├── assets/              # Product and brand images
├── database.js          # SQLite schema and local seed data
├── index.html           # Storefront
├── admin.html           # Admin dashboard
├── script.js            # Storefront behavior
├── admin-script.js      # Admin behavior
├── server.js            # Express API and local server
├── test/                # Payment-safety tests
└── shop.db              # Local SQLite data; currently tracked and must not be deployed
```

## References

- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Vercel Marketplace storage](https://vercel.com/docs/storage)
- [Postgres on Vercel](https://vercel.com/docs/postgres)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
