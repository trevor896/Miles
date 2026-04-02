const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Database setup
const db = new sqlite3.Database('./database/miles.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table with roles
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'buyer', 'seller')),
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT DEFAULT 'USA',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1
    )`);

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category TEXT,
        type TEXT,
        colour TEXT,
        size TEXT,
        image_url TEXT,
        stock_quantity INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seller_id) REFERENCES users(id)
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status TEXT DEFAULT 'pending',
        shipping_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id)
    )`);

    // Order items table
    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    console.log('Database tables initialized.');
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Role-based authorization middleware
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Routes

// User registration
app.post('/api/auth/register', [
    body('username').isLength({ min: 3 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['buyer', 'seller']),
    body('first_name').optional().trim().escape(),
    body('last_name').optional().trim().escape(),
    body('phone').optional().isMobilePhone(),
    body('address').optional().trim().escape(),
    body('city').optional().trim().escape(),
    body('state').optional().trim().escape(),
    body('zip_code').optional().trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role, first_name, last_name, phone, address, city, state, zip_code } = req.body;

    try {
        // Check if user already exists
        db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (existingUser) {
                return res.status(400).json({ error: 'User with this email or username already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            const sql = `INSERT INTO users (username, email, password, role, first_name, last_name, phone, address, city, state, zip_code)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(sql, [username, email, hashedPassword, role, first_name, last_name, phone, address, city, state, zip_code], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error creating user' });
                }

                // Generate JWT token
                const token = jwt.sign(
                    { id: this.lastID, username, email, role },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.status(201).json({
                    message: 'User registered successfully',
                    token,
                    user: { id: this.lastID, username, email, role }
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// User login
app.post('/api/auth/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').exists()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                first_name: user.first_name,
                last_name: user.last_name
            }
        });
    });
});

// Get user profile
app.get('/api/auth/profile', authenticateToken, (req, res) => {
    db.get('SELECT id, username, email, role, first_name, last_name, phone, address, city, state, zip_code, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    });
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin'), (req, res) => {
    db.all('SELECT id, username, email, role, first_name, last_name, is_active, created_at FROM users ORDER BY created_at DESC', [], (err, users) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ users });
    });
});

// Get active users count (total registered users)
app.get('/api/active-users', (req, res) => {
    db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1', [], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ activeUsers: row.count });
    });
});

// Get sales percentage change for a period
app.get('/api/sales-percentage', (req, res) => {
    const { period } = req.query;
    if (!['day', 'week', 'month', 'year'].includes(period)) {
        return res.status(400).json({ error: 'Invalid period. Use day, week, month, or year.' });
    }

    // Calculate date ranges
    const now = new Date();
    let currentStart, currentEnd, previousStart, previousEnd;

    switch (period) {
        case 'day':
            currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            previousEnd = currentStart;
            break;
        case 'week':
            const weekStart = now.getDate() - now.getDay();
            currentStart = new Date(now.getFullYear(), now.getMonth(), weekStart);
            currentEnd = new Date(now.getFullYear(), now.getMonth(), weekStart + 7);
            previousStart = new Date(now.getFullYear(), now.getMonth(), weekStart - 7);
            previousEnd = currentStart;
            break;
        case 'month':
            currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
            currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            previousEnd = currentStart;
            break;
        case 'year':
            currentStart = new Date(now.getFullYear(), 0, 1);
            currentEnd = new Date(now.getFullYear() + 1, 0, 1);
            previousStart = new Date(now.getFullYear() - 1, 0, 1);
            previousEnd = currentStart;
            break;
    }

    const formatDate = (date) => date.toISOString().split('T')[0];

    const currentStartStr = formatDate(currentStart);
    const currentEndStr = formatDate(currentEnd);
    const previousStartStr = formatDate(previousStart);
    const previousEndStr = formatDate(previousEnd);

    const sql = `
        SELECT 
            SUM(CASE WHEN created_at >= ? AND created_at < ? THEN total_amount ELSE 0 END) as current_sales,
            SUM(CASE WHEN created_at >= ? AND created_at < ? THEN total_amount ELSE 0 END) as previous_sales
        FROM orders
    `;

    db.get(sql, [currentStartStr, currentEndStr, previousStartStr, previousEndStr], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const currentSales = row.current_sales || 0;
        const previousSales = row.previous_sales || 0;

        let percentage = 0;
        if (previousSales > 0) {
            percentage = ((currentSales - previousSales) / previousSales) * 100;
        } else if (currentSales > 0) {
            percentage = 100; // If no previous sales but current has sales
        }

        res.json({ percentage: percentage.toFixed(1) });
    });
});

// Get monthly sales for last 6 months
app.get('/api/monthly-sales', (req, res) => {
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            start: date.toISOString().split('T')[0],
            end: new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString().split('T')[0]
        });
    }

    const promises = months.map(m => {
        return new Promise((resolve, reject) => {
            db.get('SELECT SUM(total_amount) as sales FROM orders WHERE created_at >= ? AND created_at < ?', [m.start, m.end], (err, row) => {
                if (err) reject(err);
                resolve({ month: m.month, sales: row.sales || 0 });
            });
        });
    });

    Promise.all(promises).then(results => {
        res.json({ monthlySales: results });
    }).catch(err => res.status(500).json({ error: 'Database error' }));
});

// Get products (public)
app.get('/api/products', (req, res) => {
    const { category, page = 1, limit = 9 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT p.*, u.username as seller_name FROM products p
               JOIN users u ON p.seller_id = u.id
               WHERE p.is_active = 1`;
    let params = [];

    if (category && category !== 'All') {
        sql += ' AND p.category = ?';
        params.push(category);
    }

    sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(sql, params, (err, products) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ products, page: parseInt(page), limit: parseInt(limit) });
    });
});

// Add product (seller only)
app.post('/api/products', authenticateToken, authorizeRoles('seller'), [
    body('name').notEmpty(),
    body('description').optional(),
    body('price').isFloat({ min: 0 }),
    body('category').notEmpty(),
    body('type').optional(),
    body('colour').optional(),
    body('size').optional(),
    body('image_url').notEmpty(),
    body('stock_quantity').isInt({ min: 0 }),
    body('discount').optional()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price, category, type, colour, size, image_url, stock_quantity, discount } = req.body;

    // Accept base64 or URL for image_url
    let imageData = image_url;
    // Optionally validate base64 format
    // If image_url starts with 'data:image/', treat as base64
    // Otherwise, treat as URL

    const sql = `INSERT INTO products (seller_id, name, description, price, category, type, colour, size, image_url, stock_quantity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [req.user.id, name, description, price, category, type, colour, size, imageData, stock_quantity], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Error creating product' });
        }

        res.status(201).json({
            message: 'Product created successfully',
            product: {
                id: this.lastID,
                seller_id: req.user.id,
                name,
                description,
                price,
                category,
                type,
                colour,
                size,
                image_url: imageData,
                stock_quantity,
                discount: discount || 0
            }
        });
    });
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, 'marketplace.html'));
});

app.get('/aboutus', (req, res) => {
    res.sendFile(path.join(__dirname, 'aboutus.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/seller-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'seller-dashboard.html'));
});

app.get('/buyer-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'buyer-dashboard.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Miles E-commerce server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});