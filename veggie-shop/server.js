const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const path = require('path');
const { Paypack } = require('paypack-js').default ? require('paypack-js') : { Paypack: require('paypack-js') };

// Correct commonjs import for paypack-js
const PaypackSDK = require('paypack-js').default || require('paypack-js');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const JWT_SECRET = process.env.JWT_SECRET || 'fresh-veggies-secret-key-2026';

// Initialize Paypack with Environment Variables or Test Keys
const paypack = new PaypackSDK({
    client_id: process.env.PAYPACK_CLIENT_ID || 'pk_test_23c437d3b2290a0f27730ee10e60c71569177325', 
    client_secret: process.env.PAYPACK_CLIENT_SECRET || 'sk_test_cf8a8a965940f8aca70ad79ed30b1deaa936e173'
});

// Mock Email Transporter (For demonstration/development)
// In production, users should configure their own SMTP settings
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    auth: {
        user: process.env.EMAIL_USER || 'mario.hills@ethereal.email',
        pass: process.env.EMAIL_PASS || '6G7N8G7N8G7N8G7N'
    }
});

async function sendOrderConfirmation(orderData) {
    console.log(`Sending confirmation email to ${orderData.email}...`);
    // Note: This is an ethereal (test) account. Emails won't reach real inboxes but can be viewed at ethereal.email
    try {
        const info = await transporter.sendMail({
            from: '"FreshVeggies Shop" <orders@freshveggies.com>',
            to: orderData.email,
            subject: `Order Confirmed! Your Order ID: #${orderData.id}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
                    <h2 style="color: #22c55e;">Order Confirmed!</h2>
                    <p>Hi ${orderData.name},</p>
                    <p>Thank you for shopping with FreshVeggies. We've received your order and are currently processing it.</p>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Order ID:</strong> #${orderData.id}</p>
                        <p style="margin: 0;"><strong>Status:</strong> Processing</p>
                        <p style="margin: 0;"><strong>Total:</strong> Ksh ${orderData.total.toFixed(2)}</p>
                    </div>
                    <p>You can track your order status on our website using your email and Order ID.</p>
                    <p>Stay fresh!</p>
                </div>
            `
        });
        console.log("Email sent: %s", info.messageId);
    } catch (error) {
        console.error("Email error:", error);
    }
}

// Middleware
app.use(cors());
app.use(express.json());

// --- AUTHENTICATION ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, address, phone } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO Users (name, email, password, address, phone) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [name, email, hashedPassword, address, phone], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: "Email already exists" });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ message: "User created successfully!", userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    db.get("SELECT * FROM Users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid email or password" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                address: user.address,
                phone: user.phone
            }
        });
    });
});

// Middleware to verify JWT
const authenticate = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token.split(' ')[1], JWT_SECRET);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).json({ error: "Invalid token." });
    }
};

// Get Profile & Order History
app.get('/api/user/profile', authenticate, (req, res) => {
    db.get("SELECT id, name, email, address, phone FROM Users WHERE id = ?", [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const sqlOrders = `
            SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
            FROM Orders o
            JOIN Order_Items oi ON o.id = oi.order_id
            JOIN Products p ON oi.product_id = p.id
            WHERE o.user_id = ?
            GROUP BY o.id
            ORDER BY o.order_date DESC
        `;
        db.all(sqlOrders, [req.user.id], (err, orders) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ user, orders });
        });
    });
});

// Update Profile
app.patch('/api/user/profile', authenticate, (req, res) => {
    const { name, address, phone } = req.body;
    db.run("UPDATE Users SET name = ?, address = ?, phone = ? WHERE id = ?", 
        [name, address, phone, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Profile updated successfully" });
    });
});

// Get all products
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM Products", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new order
app.post('/api/orders', (req, res) => {
    const { name, email, address, items, subtotal, deliveryFee, total, userId } = req.body;
    
    if (!name || !email || !address || !items || !items.length) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Insert order
    const sqlOrder = `INSERT INTO Orders (user_id, customer_name, customer_email, address, subtotal, delivery_fee, total_price) 
                      VALUES (?, ?, ?, ?, ?, ?, ?)`;
                      
    db.run(sqlOrder, [userId || null, name, email, address, subtotal, deliveryFee, total], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        const orderId = this.lastID;
        
        // Insert order items
        const sqlItem = `INSERT INTO Order_Items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)`;
        const stmt = db.prepare(sqlItem);
        
        items.forEach(item => {
            stmt.run(orderId, item.id, item.quantity, item.price);
        });
        
        stmt.finalize((err) => {
            if (err) {
                 return res.status(500).json({ error: err.message });
            }
            
            // Send confirmation email (async)
            sendOrderConfirmation({ id: orderId, name, email, total });

            res.status(201).json({ 
                message: "Order placed successfully!",
                orderId: orderId 
            });
        });
    });
});

// Paypack Payment Initiation Endpoint (STK Push)
app.post('/api/pay', async (req, res) => {
    const { amount, phone } = req.body;

    if (!amount || !phone) {
        return res.status(400).json({ error: "Amount and phone number are required" });
    }

    try {
        console.log(`Initiating Paypack cashin for ${amount} to ${phone}...`);
        
        // This initiates the STK push (Cashin)
        const response = await paypack.cashin({
            amount: Number(amount),
            number: String(phone)
        });

        console.log('Paypack Response:', response.data);
        
        res.status(200).json({
            message: "Payment initiated successfully",
            data: response.data
        });
    } catch (error) {
        console.error('Paypack Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            error: "Payment initiation failed", 
            details: error.response ? error.response.data : error.message 
        });
    }
});

// Track Order
app.get('/api/orders/track', (req, res) => {
    const { orderId, email } = req.query;
    if (!orderId || !email) {
        return res.status(400).json({ error: "Order ID and Email are required" });
    }

    const sql = `
        SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
        FROM Orders o
        JOIN Order_Items oi ON o.id = oi.order_id
        JOIN Products p ON oi.product_id = p.id
        WHERE o.id = ? AND o.customer_email = ?
        GROUP BY o.id
    `;
    db.get(sql, [orderId, email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Order not found. Please check your ID and Email." });
        }
        res.json(row);
    });
});

// ADMIN: Get all orders
app.get('/api/admin/orders', (req, res) => {
    const sql = `
        SELECT o.*, GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')', ', ') as items_summary
        FROM Orders o
        JOIN Order_Items oi ON o.id = oi.order_id
        JOIN Products p ON oi.product_id = p.id
        GROUP BY o.id
        ORDER BY o.order_date DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ADMIN: Add new product
app.post('/api/admin/products', (req, res) => {
    const { name, price, weight, category, image, badge } = req.body;
    if (!name || !price || !category || !image) {
        return res.status(400).json({ error: "Missing required product fields" });
    }
    const sql = `INSERT INTO Products (name, price, weight, category, image, badge, in_stock) VALUES (?, ?, ?, ?, ?, ?, 1)`;
    db.run(sql, [name, price, weight, category, image, badge], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, message: "Product added successfully" });
    });
});

// ADMIN: Toggle product stock status
app.patch('/api/admin/products/:id', (req, res) => {
    const { in_stock } = req.body;
    const { id } = req.params;
    db.run("UPDATE Products SET in_stock = ? WHERE id = ?", [in_stock ? 1 : 0, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Stock status updated" });
    });
});

// ADMIN: Update order status
app.patch('/api/admin/orders/:id/status', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    if (!status) {
        return res.status(400).json({ error: "Status is required" });
    }
    db.run("UPDATE Orders SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Order status updated successfully" });
    });
});

// Serve Static Frontend Files (as fallback)
app.use(express.static(__dirname));

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
