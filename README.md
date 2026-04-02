<<<<<<< HEAD
# Miles E-commerce Backend

A full-stack e-commerce platform with user role management (Admin, Buyer, Seller) built with Node.js, Express, and SQLite.

## Features

### User Roles & Authentication
- **Admin**: Full system access, user management, analytics
- **Seller**: Product management, order tracking, sales analytics
- **Buyer**: Shopping, order history, favorites, reviews

### Database Schema
- **Users**: Authentication, profiles, roles
- **Products**: Inventory management with categories, types, colors, sizes
- **Orders**: Purchase tracking and order management
- **Order Items**: Detailed order contents

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (authenticated)

#### Products
- `GET /api/products` - Get all products (public)
- `POST /api/products` - Add new product (seller only)

#### Admin Only
- `GET /api/admin/users` - Get all users

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   - The `.env` file is already configured with default settings
   - Change `JWT_SECRET` in production for security

3. **Start the Server**
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - API endpoints available at http://localhost:3000/api/*

## Database

The application uses SQLite database (`database/miles.db`) which is automatically created and initialized when the server starts.

### Default Database Tables
- `users` - User accounts and profiles
- `products` - Product catalog
- `orders` - Purchase orders
- `order_items` - Order line items

## User Roles

### Admin User
- Can view all users
- Access to system analytics
- User management capabilities

### Seller User
- Can add/edit/delete their own products
- View sales analytics
- Manage inventory

### Buyer User
- Browse and purchase products
- View order history
- Manage favorites and reviews

## API Usage Examples

### Register a New User
```javascript
fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'johndoe',
        email: 'john@example.com',
        password: 'password123',
        role: 'buyer',
        first_name: 'John',
        last_name: 'Doe'
    })
});
```

### Login
```javascript
fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'john@example.com',
        password: 'password123'
    })
});
```

### Add Product (Seller Only)
```javascript
fetch('/api/products', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
    },
    body: JSON.stringify({
        name: 'Sample Product',
        price: 29.99,
        category: 'Sweatshirt',
        stock_quantity: 10
    })
});
```

## Frontend Pages

- `/` - Home page
- `/signup` - User registration
- `/login` - User login
- `/marketplace` - Product browsing
- `/admin-dashboard` - Admin panel
- `/seller-dashboard` - Seller panel
- `/buyer-dashboard` - Buyer panel

## Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Role-based access control
- Input validation and sanitization
- CORS enabled for cross-origin requests

## Development

### Project Structure
```
miles-ecommerce/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env                   # Environment variables
├── database/              # SQLite database files
├── *.html                 # Frontend pages
└── README.md             # This file
```

### Adding New Features

1. **New API Endpoints**: Add routes in `server.js`
2. **Database Changes**: Update the `initializeDatabase()` function
3. **Frontend Updates**: Modify HTML/JS files as needed
4. **Authentication**: Use `authenticateToken` and `authorizeRoles` middleware

## Production Deployment

1. Set secure `JWT_SECRET` in environment variables
2. Use a production database (PostgreSQL/MySQL) instead of SQLite
3. Enable HTTPS
4. Configure proper CORS settings
5. Set up proper logging and monitoring

## Support

For issues or questions, please check the code comments in `server.js` or create an issue in the repository.
=======
