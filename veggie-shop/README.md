# Veggie Shop

A modern, responsive full-stack eCommerce web application for selling fresh organic vegetables. 

![Veggie Store](assets/hero-bg.jpg) 

## Overview
Veggie Shop is a beautifully designed, nature-inspired eCommerce platform that allows users to browse a catalog of fresh produce, manage a shopping cart, and complete a secure checkout process. 

The project is a full-stack demo featuring user authentication, an administrative dashboard, order tracking, and mobile money payment initiation. Production use still requires a durable database and verified payment settlement handling.

## Key Features

### User & Shopping Experience
- **User Authentication:** Secure Signup and Login system using JWT and Bcrypt password hashing.
- **Personalized Profiles:** Logged-in users can save their delivery addresses and contact information.
- **Order History:** Users can view their past orders and current order statuses directly from their profile.
- **Dynamic Product Catalog:** Fetches real-time data from the SQLite database with smart filtering by category and search.
- **Multi-language Support:** Seamless toggle between **English** and **Swahili** across the entire interface.
- **Sliding Shopping Cart:** A premium, animated sidebar for managing items without page reloads.
- **WhatsApp Integration:** Direct "Chat on WhatsApp" floating button for instant customer support.

### Order Management & Tracking
- **Real-time Tracking:** Customers can track their orders using their Email and Order ID.
- **Email Notifications:** Order confirmations are sent through Nodemailer when SMTP settings are configured; otherwise delivery is skipped.
- **Checkout Flow:** Collects shipping details and verifies product prices and totals on the server.

### Administrative Tools
- **Admin Dashboard:** A dedicated panel (`admin.html`) for store managers.
- **Order Management:** View all incoming orders and update their fulfillment status (Processing, Shipped, Delivered).
- **Inventory Control:** Add new products to the catalog and toggle stock availability in real-time.

## Technology Stack

### Frontend
- **HTML5 & Vanilla CSS:** Custom design system using CSS Grid, Flexbox, and modern animations.
- **Vanilla JavaScript:** Responsive state management and Fetch API for backend communication.
- **FontAwesome & Google Fonts:** Using "Outfit" typography and crisp iconography.

### Backend
- **Node.js & Express.js:** RESTful API architecture.
- **SQLite3:** Relational database for persistent storage (Users, Products, Orders).
- **Security:** **JWT** for session management and **BcryptJS** for credential security.
- **Communication:** **Nodemailer** for automated transactional emails.

### Payment Integration
- **KES payments:** Online payment is disabled. Paypack's official API/SDK documentation does not confirm support for Kenya, Kenyan `+254` numbers, KES denomination, or transaction currency verification. Do not configure Paypack credentials for this store or treat pending orders as paid.
- Orders can be captured for follow-up, but remain in `Pending Payment`; no payment prompt is initiated and fulfillment is blocked until a KES-compatible provider is integrated.

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd veggie-shop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` and set a strong `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Do not add Paypack credentials for this Kenyan KES store unless official/account-specific documentation confirms KES compatibility.

### Running the Application
1. Start the backend server:
   ```bash
   npm start
   ```
   *The server runs on `http://localhost:3000`.*

2. Open `http://localhost:3000` in your browser. The Express server hosts both the storefront and its API; opening `index.html` directly is not supported.

### Production Readiness
Do not deploy this version for live sales until SQLite has been moved to durable managed storage. Online KES payment is disabled because Paypack's published materials do not confirm Kenyan KES support or currency-match verification. Integrate a KES-compatible provider before accepting or fulfilling paid orders.

Run `npm test` to execute the payment-safety integration tests against an isolated temporary SQLite database. The tests do not contact Paypack.

## API Reference

### Public Endpoints
- `GET /api/products` - List all products.
- `POST /api/auth/signup` - Register a new user.
- `POST /api/auth/login` - Authenticate and receive a JWT.
- `GET /api/orders/track` - Search order details by ID and Email.

### User Endpoints (Protected)
- `GET /api/user/profile` - Fetch user details and personal order history.
- `POST /api/orders` - Place a new order.
- `POST /api/pay` - Returns `503` while no KES-compatible provider is configured; it never initiates a Paypack transaction.

### Admin Endpoints
- `GET /api/admin/orders` - View all system orders.
- `POST /api/admin/products` - Add new inventory.
- `PATCH /api/admin/orders/:id/status` - Update order fulfillment state.

## Project Structure
```text
veggie-shop/
├── assets/                 # Brand assets and product photography
├── database.js             # SQLite schema and seeding logic
├── index.html              # Main customer-facing application
├── admin.html              # Management dashboard
├── admin-script.js         # Admin panel logic
├── server.js               # Express API and server configuration
├── script.js               # Core frontend logic (Cart, Auth, Tracking)
├── styles.css              # Customer UI styles
└── admin-styles.css        # Admin UI styles
```

---
*Developed for a premium, farm-to-table digital experience.*
