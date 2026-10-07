require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const db = require('./database');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@freshveggies.local').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
const privateFiles = new Set([
    '/server.js', '/database.js', '/package.json', '/package-lock.json', '/.env', '/.env.example',
    '/shop.db', '/readme.md', '/deploy.md', '/dockerfile', '/.gitignore',
]);

if (process.env.NODE_ENV === 'production' && (
    !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !ADMIN_PASSWORD || !process.env.ALLOWED_ORIGINS
)) {
    throw new Error('Production requires a 32-character JWT_SECRET, ADMIN_PASSWORD, and ALLOWED_ORIGINS.');
}

function sanitizeText(value, maxLength = 200) {
    if (typeof value !== 'string') return '';
    const cleaned = value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, maxLength);
}

function sanitizeUrl(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    const cleaned = value.trim();
    if (!cleaned) return '';
    if (/^(https?:\/\/|\/)/i.test(cleaned)) {
        return cleaned.slice(0, maxLength);
    }
    return '';
}

function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

const transporter = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    })
    : null;

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please slow down.' },
});

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

async function sendOrderConfirmation(orderData) {
    if (!transporter) {
        console.log('Email delivery is not configured. Skipping order confirmation email.');
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: 'FreshVeggies Shop <orders@freshveggies.com>',
            to: orderData.email,
            subject: `Order Received - Payment Pending #${orderData.id}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
                    <h2 style="color: #b45309;">Order Received - Payment Pending</h2>
                    <p>Hi ${sanitizeText(orderData.name, 80)},</p>
                    <p>We have received your order. Payment has not been received, and the order will not be processed until a supported KES payment method is available.</p>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Order ID:</strong> #${orderData.id}</p>
                        <p style="margin: 0;"><strong>Payment status:</strong> Pending</p>
                        <p style="margin: 0;"><strong>Total:</strong> Ksh ${Number(orderData.total || 0).toFixed(2)}</p>
                    </div>
                    <p>You can track your order status on our website using your email and Order ID.</p>
                    <p>Stay fresh!</p>
                </div>
            `,
        });

        console.log('Email sent:', info.messageId);
    } catch (error) {
        console.error('Email delivery failed:', error.message);
    }
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. Authentication required.' });
    }

    const token = header.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

function optionalAuthenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
        return next();
    }

    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Invalid authorization header.' });
    }

    try {
        req.user = jwt.verify(header.substring(7), JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    return next();
}

function buildUserPayload(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        address: user.address || '',
        phone: user.phone || '',
        is_admin: Boolean(user.is_admin),
    };
}

async function ensureAdminUser() {
    if (!ADMIN_PASSWORD) {
        console.warn('Admin account is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD to enable admin login.');
        return;
    }

    await db.ready;
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    db.get('SELECT id FROM Users WHERE email = ?', [ADMIN_EMAIL], async (err, existingUser) => {
        if (err) {
            console.error('Error loading admin user:', err.message);
            return;
        }

        if (existingUser) {
            db.run('UPDATE Users SET password = ?, is_admin = 1 WHERE email = ?', [passwordHash, ADMIN_EMAIL], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating admin user:', updateErr.message);
                } else {
                    console.log('Admin account updated successfully.');
                }
            });
            return;
        }

        db.run(
            'INSERT INTO Users (name, email, password, address, phone, is_admin) VALUES (?, ?, ?, ?, ?, 1)',
            ['Administrator', ADMIN_EMAIL, passwordHash, 'Admin Office', ''],
            (insertErr) => {
                if (insertErr) {
                    console.error('Error creating admin user:', insertErr.message);
                    return;
                }

                console.log('Admin account created successfully.');
            }
        );
    });
}

app.post('/api/auth/signup', async (req, res) => {
    const name = sanitizeText(req.body.name, 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const address = sanitizeText(req.body.address, 200);
    const phone = sanitizeText(req.body.phone, 30);

    if (!name || !email || !password || !validateEmail(email) || password.length < 8) {
        return res.status(400).json({ error: 'Please provide a valid name, email, and password (minimum 8 characters).' });
    }

    try {
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Users WHERE email = ?', [email], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        db.run(
            'INSERT INTO Users (name, email, password, address, phone, is_admin) VALUES (?, ?, ?, ?, ?, 0)',
            [name, email, hashedPassword, address || null, phone || null],
            function onInsert(err) {
                if (err) {
                    if (String(err.message).includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists.' });
                    }
                    return res.status(500).json({ error: 'Unable to create account right now.' });
                }

                return res.status(201).json({ message: 'User created successfully!', userId: this.lastID });
            }
        );
    } catch (error) {
        console.error('Signup error:', error.message);
        return res.status(500).json({ error: 'Unable to create account right now.' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password || !validateEmail(email)) {
        return res.status(400).json({ error: 'Please provide a valid email and password.' });
    }

    db.get('SELECT * FROM Users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Login error:', err.message);
            return res.status(500).json({ error: 'Unable to process login request.' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, is_admin: Boolean(user.is_admin) },
            JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '12h' }
        );

        return res.json({
            message: 'Login successful',
            token,
            user: buildUserPayload(user),
        });
    });
});

app.get('/api/admin/me', authenticate, requireAdmin, (req, res) => {
    res.json({
        id: req.user.id,
        email: req.user.email,
        isAdmin: true,
    });
});

app.get('/api/user/profile', authenticate, (req, res) => {
    db.get('SELECT id, name, email, address, phone, is_admin FROM Users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Profile load error:', err.message);
            return res.status(500).json({ error: 'Unable to load profile.' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const sqlOrders = `
            SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
            FROM Orders o
            LEFT JOIN Order_Items oi ON o.id = oi.order_id
            LEFT JOIN Products p ON oi.product_id = p.id
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.order_date DESC
        `;

        db.all(sqlOrders, [req.user.id], (orderErr, orders) => {
            if (orderErr) {
                console.error('Profile order error:', orderErr.message);
                return res.status(500).json({ error: 'Unable to load orders.' });
            }

            res.json({ user: buildUserPayload(user), orders });
        });
    });
});

app.patch('/api/user/profile', authenticate, (req, res) => {
    const name = sanitizeText(req.body.name, 80);
    const address = sanitizeText(req.body.address, 200);
    const phone = sanitizeText(req.body.phone, 30);

    if (!name) {
        return res.status(400).json({ error: 'A valid name is required.' });
    }

    db.run('UPDATE Users SET name = ?, address = ?, phone = ? WHERE id = ?', [name, address || null, phone || null, req.user.id], function onUpdate(err) {
        if (err) {
            console.error('Profile update error:', err.message);
            return res.status(500).json({ error: 'Unable to update profile.' });
        }

        res.json({ message: 'Profile updated successfully' });
    });
});

app.get('/api/products', (req, res) => {
    db.all('SELECT * FROM Products ORDER BY id ASC', [], (err, rows) => {
        if (err) {
            console.error('Products load error:', err.message);
            return res.status(500).json({ error: 'Unable to load products.' });
        }

        res.json(rows);
    });
});

app.post('/api/orders', optionalAuthenticate, async (req, res) => {
    const name = sanitizeText(req.body.name, 80);
    const email = String(req.body.email || '').trim().toLowerCase();
    const address = sanitizeText(req.body.address, 200);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const deliveryFee = 300;

    if (!name || !email || !address || !validateEmail(email) || items.length === 0 || items.length > 50) {
        return res.status(400).json({ error: 'Order details are missing or invalid.' });
    }

    if (req.body.userId && (!req.user || Number(req.user.id) !== Number(req.body.userId))) {
        return res.status(403).json({ error: 'You cannot place an order for another user.' });
    }

    const validItemIds = items.map((item) => Number(item.id)).filter(Number.isInteger);
    if (validItemIds.length !== items.length) {
        return res.status(400).json({ error: 'Invalid product references detected.' });
    }

    try {
        const uniqueIds = [...new Set(validItemIds)];
        const placeholders = uniqueIds.map(() => '?').join(',');
        const productRows = await new Promise((resolve, reject) => {
            db.all(`SELECT * FROM Products WHERE id IN (${placeholders})`, uniqueIds, (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const productMap = new Map(productRows.map((product) => [product.id, product]));
        let computedSubtotal = 0;
        const normalizedItems = [];

        for (const item of items) {
            const productId = Number(item.id);
            const qty = Number(item.quantity);
            if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1 || qty > 1000) {
                return res.status(400).json({ error: 'Each cart item must include a valid product and quantity.' });
            }

            const product = productMap.get(productId);
            if (!product || product.in_stock === 0) {
                return res.status(400).json({ error: 'One or more selected products are unavailable.' });
            }

            const expectedPrice = Number(product.price);

            computedSubtotal += expectedPrice * qty;
            normalizedItems.push({ product_id: productId, quantity: qty, price_at_purchase: expectedPrice });
        }

        const computedTotal = computedSubtotal + deliveryFee;

        const safeUserId = req.user && req.user.id ? Number(req.user.id) : null;

        const sqlOrder = `
            INSERT INTO Orders (user_id, customer_name, customer_email, address, subtotal, delivery_fee, total_price, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Payment')
        `;

        db.run(sqlOrder, [safeUserId, name, email, address, computedSubtotal, deliveryFee, computedTotal], function onOrderInsert(err) {
            if (err) {
                console.error('Order creation error:', err.message);
                return res.status(500).json({ error: 'Unable to place order right now.' });
            }

            const orderId = this.lastID;
            const stmt = db.prepare('INSERT INTO Order_Items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)');

            normalizedItems.forEach((item) => {
                stmt.run(orderId, item.product_id, item.quantity, item.price_at_purchase);
            });

            stmt.finalize((finalizeErr) => {
                if (finalizeErr) {
                    console.error('Order item insert error:', finalizeErr.message);
                    return res.status(500).json({ error: 'Order created but item details could not be stored.' });
                }

                sendOrderConfirmation({ id: orderId, name, email, total: computedTotal });

                return res.status(201).json({
                    message: 'Order received. Payment is pending.',
                    orderId,
                    subtotal: computedSubtotal,
                    deliveryFee,
                    total: computedTotal,
                    payment_status: 'pending_payment',
                });
            });
        });
    } catch (error) {
        console.error('Order validation error:', error.message);
        return res.status(500).json({ error: 'Unable to validate order.' });
    }
});

app.post('/api/pay', async (req, res) => {
    return res.status(503).json({
        error: 'Online KES payments are unavailable. No payment was initiated.',
        code: 'KES_PAYMENT_PROVIDER_UNAVAILABLE',
    });
});

app.get('/api/orders/track', (req, res) => {
    const orderId = Number(req.query.orderId);
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!Number.isInteger(orderId) || orderId <= 0 || !email || !validateEmail(email)) {
        return res.status(400).json({ error: 'Order ID and Email are required.' });
    }

    const sql = `
        SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
        FROM Orders o
        LEFT JOIN Order_Items oi ON o.id = oi.order_id
        LEFT JOIN Products p ON oi.product_id = p.id
        WHERE o.id = ? AND o.customer_email = ?
        GROUP BY o.id
    `;

    db.get(sql, [orderId, email], (err, row) => {
        if (err) {
            console.error('Order tracking error:', err.message);
            return res.status(500).json({ error: 'Unable to track order.' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Order not found. Please check your ID and Email.' });
        }

        return res.json({
            ...row,
            payment_status: row.status === 'Pending Payment'
                ? 'pending_payment'
                : row.status === 'Payment Cancelled' ? 'payment_cancelled' : 'unverified',
        });
    });
});

app.get('/api/admin/orders', authenticate, requireAdmin, (req, res) => {
    const sql = `
        SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
        FROM Orders o
        LEFT JOIN Order_Items oi ON o.id = oi.order_id
        LEFT JOIN Products p ON oi.product_id = p.id
        GROUP BY o.id
        ORDER BY o.order_date DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Admin order error:', err.message);
            return res.status(500).json({ error: 'Unable to load orders.' });
        }

        res.json(rows.map((order) => ({
            ...order,
            payment_status: order.status === 'Pending Payment'
                ? 'pending_payment'
                : order.status === 'Payment Cancelled' ? 'payment_cancelled' : 'unverified',
        })));
    });
});

app.post('/api/admin/products', authenticate, requireAdmin, (req, res) => {
    const name = sanitizeText(req.body.name, 80);
    const price = Number(req.body.price);
    const weight = sanitizeText(req.body.weight, 60);
    const category = sanitizeText(req.body.category, 50);
    const image = sanitizeUrl(req.body.image, 500);
    const badge = sanitizeText(req.body.badge, 50);

    if (!name || !Number.isFinite(price) || price <= 0 || !weight || !category || !image) {
        return res.status(400).json({ error: 'Please provide valid product details.' });
    }

    db.run(
        'INSERT INTO Products (name, price, weight, category, image, badge, in_stock) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [name, price, weight, category, image, badge || null],
        function onInsert(err) {
            if (err) {
                console.error('Admin product insert error:', err.message);
                return res.status(500).json({ error: 'Unable to create product.' });
            }

            return res.status(201).json({ id: this.lastID, message: 'Product added successfully' });
        }
    );
});

app.patch('/api/admin/products/:id', authenticate, requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const isInStock = req.body.in_stock === true || req.body.in_stock === 1 || req.body.in_stock === 'true';

    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'A valid product ID is required.' });
    }

    db.run('UPDATE Products SET in_stock = ? WHERE id = ?', [isInStock ? 1 : 0, productId], function onUpdate(err) {
        if (err) {
            console.error('Product stock update error:', err.message);
            return res.status(500).json({ error: 'Unable to update stock.' });
        }

        res.json({ message: 'Stock status updated' });
    });
});

app.patch('/api/admin/orders/:id/status', authenticate, requireAdmin, (req, res) => {
    const orderId = Number(req.params.id);
    const status = sanitizeText(req.body.status, 40);
    const allowedStatuses = ['Processing', 'In Transit', 'Delivered', 'Cancelled', 'Payment Cancelled'];

    if (!Number.isInteger(orderId) || orderId <= 0 || !allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status is required and must be valid.' });
    }

    db.get('SELECT status FROM Orders WHERE id = ?', [orderId], (lookupErr, order) => {
        if (lookupErr) {
            console.error('Order status lookup error:', lookupErr.message);
            return res.status(500).json({ error: 'Unable to update order status.' });
        }

        if (!order) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        if (status === order.status) {
            return res.json({ message: 'Order status is unchanged.' });
        }

        if (['Processing', 'In Transit', 'Delivered'].includes(status)) {
            return res.status(409).json({ error: 'Order fulfillment is disabled until a KES payment is independently verified.' });
        }

        if (order.status === 'Pending Payment' && status !== 'Payment Cancelled') {
            return res.status(409).json({ error: 'An unpaid order can only remain pending or be cancelled.' });
        }

        if (order.status === 'Payment Cancelled' && status !== 'Cancelled') {
            return res.status(409).json({ error: 'A payment-cancelled order cannot re-enter processing.' });
        }

        db.run('UPDATE Orders SET status = ? WHERE id = ?', [status, orderId], function onUpdate(err) {
            if (err) {
                console.error('Order status update error:', err.message);
                return res.status(500).json({ error: 'Unable to update order status.' });
            }

            res.json({ message: 'Order status updated successfully' });
        });
    });
});

app.use((req, res, next) => {
    if (privateFiles.has(req.path.toLowerCase())) {
        return res.sendStatus(404);
    }
    return next();
});

app.use(express.static(path.join(__dirname)));

app.use((error, req, res, next) => {
    if (error && error.message && error.message.toLowerCase().includes('origin not allowed')) {
        return res.status(403).json({ error: 'CORS policy blocked this request.' });
    }

    console.error('Unhandled server error:', error);
    return res.status(500).json({ error: 'Something went wrong.' });
});

ensureAdminUser().catch((error) => {
    console.error('Admin initialization failed:', error.message);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
