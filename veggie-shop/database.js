const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, 'shop.db'));
let resolveDatabaseReady;
let rejectDatabaseReady;
const databaseReady = new Promise((resolve, reject) => {
    resolveDatabaseReady = resolve;
    rejectDatabaseReady = reject;
});
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        rejectDatabaseReady(err);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});
db.ready = databaseReady;

function initDb() {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');

        // Create Products Table
        db.run(`CREATE TABLE IF NOT EXISTS Products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            weight TEXT NOT NULL,
            category TEXT NOT NULL,
            image TEXT NOT NULL,
            badge TEXT,
            in_stock BOOLEAN DEFAULT 1
        )`);

        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            address TEXT,
            phone TEXT,
            is_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.all("PRAGMA table_info(Users)", (err, rows) => {
            if (err) {
                console.error('Error checking Users schema:', err.message);
                rejectDatabaseReady(err);
                return;
            }

            if (!rows.some((column) => column.name === 'is_admin')) {
                db.run('ALTER TABLE Users ADD COLUMN is_admin BOOLEAN DEFAULT 0', (alterErr) => {
                    if (alterErr) {
                        console.error('Error adding is_admin column:', alterErr.message);
                        rejectDatabaseReady(alterErr);
                    } else {
                        resolveDatabaseReady();
                    }
                });
            } else {
                resolveDatabaseReady();
            }
        });

        // Create Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS Orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            address TEXT NOT NULL,
            subtotal REAL NOT NULL,
            delivery_fee REAL NOT NULL,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'Processing',
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES Users (id)
        )`);

        // Create Order Items Table
        db.run(`CREATE TABLE IF NOT EXISTS Order_Items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_purchase REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES Orders (id),
            FOREIGN KEY (product_id) REFERENCES Products (id)
        )`);

        // Seed Initial Products if empty
        db.get("SELECT COUNT(*) as count FROM Products", (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (row.count === 0) {
                console.log("Seeding initial products...");
                const products = [
                    {
                        name: "Fresh Tomatoes",
                        price: 600.00,
                        weight: "1 kg",
                        category: "Roots",
                        image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=500",
                        badge: "Organic"
                    },
                    {
                        name: "Crispy Carrots",
                        price: 375.00,
                        weight: "1 kg",
                        category: "Roots",
                        image: "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&q=80&w=500",
                        badge: null
                    },
                    {
                        name: "Green Cabbage",
                        price: 300.00,
                        weight: "1 head",
                        category: "Greens",
                        image: "assets/cabbage.jpg",
                        badge: "Fresh"
                    },
                    {
                        name: "Broccoli Crowns",
                        price: 525.00,
                        weight: "2 pieces",
                        category: "Greens",
                        image: "https://images.unsplash.com/photo-1583663848850-46af132dc08e?auto=format&fit=crop&q=80&w=500",
                        badge: "Vitamin C"
                    },
                    {
                        name: "Baby Spinach",
                        price: 750.00,
                        weight: "250 g",
                        category: "Greens",
                        image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&q=80&w=500",
                        badge: "Organic"
                    },
                    {
                        name: "White Garlic",
                        price: 675.00,
                        weight: "500 g",
                        category: "Alliums",
                        image: "assets/garlic.jpg",
                        badge: "Bestseller"
                    },
                    {
                        name: "Red Onions",
                        price: 450.00,
                        weight: "1 kg",
                        category: "Alliums",
                        image: "assets/redonions.jpg",
                        badge: null
                    },
                    {
                        name: "Green Cucumber",
                        price: 225.00,
                        weight: "2 pieces",
                        category: "Roots",
                        image: "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&q=80&w=500",
                        badge: "Organic"
                    },
                    {
                        name: "Purple Eggplant",
                        price: 450.00,
                        weight: "2 pieces",
                        category: "Nightshades",
                        image: "assets/veg3.jpg",
                        badge: null
                    },
                    {
                        name: "Fresh Potatoes",
                        price: 225.00,
                        weight: "1 kg",
                        category: "Roots",
                        image: "assets/veg1.jpg",
                        badge: "Local"
                    },
                    {
                        name: "Green Peas",
                        price: 525.00,
                        weight: "500 g",
                        category: "Legumes",
                        image: "assets/veg2.jpg",
                        badge: "Fresh"
                    },
                    {
                        name: "Mixed Bell Peppers",
                        price: 300.00,
                        weight: "3 pieces",
                        category: "Nightshades",
                        image: "assets/veg4.jpg",
                        badge: "Bestseller"
                    },
                    // New Alliums
                    { name: "Yellow Onions", price: 300.00, weight: "1 kg", category: "Alliums", image: "assets/yellowonions.jpg", badge: "Pantry Staple" },
                    { name: "Shallots", price: 525.00, weight: "250 g", category: "Alliums", image: "assets/shallots.jpg", badge: null },
                    { name: "Leeks", price: 450.00, weight: "2 stalks", category: "Alliums", image: "assets/leeks.jpg", badge: "Fresh" },
                    { name: "Green Scallions", price: 185.00, weight: "1 bunch", category: "Alliums", image: "assets/scallions.jpg", badge: "Organic" },
                    { name: "Elephant Garlic", price: 900.00, weight: "1 bulb", category: "Alliums", image: "assets/elephantgarlic.jpg", badge: "Specialty" },
                    // New Roots
                    { name: "Sweet Potatoes", price: 375.00, weight: "1 kg", category: "Roots", image: "assets/sweetpotato.jpg", badge: "Rich in Vit A" },
                    { name: "Beetroots", price: 450.00, weight: "1 bunch", category: "Roots", image: "assets/beetroot.jpg", badge: "Organic" },
                    { name: "Radishes", price: 225.00, weight: "1 bunch", category: "Roots", image: "assets/radish.jpg", badge: "Crisp" },
                    { name: "Turnips", price: 300.00, weight: "500 g", category: "Roots", image: "assets/turnip.jpg", badge: null },
                    { name: "Parsnips", price: 525.00, weight: "500 g", category: "Roots", image: "assets/parsnips.jpg", badge: "Winter Special" },
                    // New Greens
                    { name: "Curly Kale", price: 450.00, weight: "1 bunch", category: "Greens", image: "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?auto=format&fit=crop&q=80&w=500", badge: "Superfood" },
                    { name: "Swiss Chard", price: 525.00, weight: "1 bunch", category: "Greens", image: "assets/swisschard.jpg", badge: "Organic" },
                    { name: "Bok Choy", price: 375.00, weight: "2 heads", category: "Greens", image: "assets/bokchoy.jpg", badge: "Fresh" },
                    { name: "Arugula (Rocket)", price: 675.00, weight: "150 g", category: "Greens", image: "assets/arugula.jpg", badge: "Spicy" },
                    { name: "Romaine Lettuce", price: 300.00, weight: "1 head", category: "Greens", image: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&q=80&w=500", badge: "Crunchy" }
                ];

                const stmt = db.prepare("INSERT INTO Products (name, price, weight, category, image, badge) VALUES (?, ?, ?, ?, ?, ?)");
                products.forEach(p => {
                    stmt.run(p.name, p.price, p.weight, p.category, p.image, p.badge);
                });
                stmt.finalize();
                console.log("Products seeded successfully.");
            }
        });
    });
}

module.exports = db;
