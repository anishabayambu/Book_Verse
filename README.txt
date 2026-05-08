# BookVerse - Online Book Store

A full-stack Node.js/Express-based online bookstore application built with security and user experience in mind.

## Quick Start: Admin Access

**Want to become an admin?** During registration, simply select **"Admin (Book Manager)"** from the Account Type dropdown. Then login with your credentials and verify your OTP to access the admin panel!

See **[ADMIN_ACCESS.md](./ADMIN_ACCESS.md)** for detailed instructions.

## Features

### Security & Authentication
- **User Registration** with account type selection (Regular User or Admin)
- **Password strength validation** (Uppercase, Lowercase, Number, Special char, 8+ chars)
- **Google reCAPTCHA** verification during registration
- **Two-Factor Authentication (2FA)** via OTP email verification
- **Password Hashing** using bcrypt with 10 salt rounds
- **Password Management**
  - Password expiration (90 days)
  - Password history (prevent reusing last 3-5 passwords)
  - Change password functionality
- **Session Management** with secure HTTP-only cookies
- **Role-Based Access Control (RBAC)** - Admin and User roles with restricted route access

### Admin Panel
- **Dashboard** with key statistics
- **Book Management**
  - Add new books with cover images
  - Edit book details
  - Delete books
  - Manage inventory/stock
  - View all orders

### User Features
- **Browse Books** with search and filtering
- **Filter by Category** (Fiction, Non-Fiction, Academic, Manga/Comics, Technology, Self-Help)
- **Shopping Cart**
  - Add/remove items
  - Update quantities
  - View cart summary
- **User Dashboard** for profile and order management
- **Responsive Design** for mobile and desktop

### Technology Stack

**Frontend:**
- HTML5
- CSS3
- Bootstrap 5
- JavaScript (Vanilla)
- EJS templating engine

**Backend:**
- Node.js
- Express.js
- MySQL 5.7+
- Nodemailer (Email service)
- bcryptjs (Password hashing)
- express-validator (Input validation)

**Security:**
- Google reCAPTCHA v2
- bcryptjs for password hashing
- Parameterized SQL queries
- Session-based authentication
- CORS protection

## Project Structure

```
bookverse/
├── config/              # Configuration files
│   └── database.js     # MySQL connection pool
├── controllers/         # Business logic
│   ├── authController.js
│   ├── adminController.js
│   ├── shopController.js
│   └── cartController.js
├── middleware/          # Custom middleware
│   └── auth.js         # Authentication middleware
├── public/              # Static files
│   ├── css/
│   │   ├── style.css   # Main styles
│   │   └── auth.css    # Auth pages styles
│   ├── js/
│   └── uploads/        # Book cover images
├── routes/              # Route handlers
│   ├── auth.js
│   ├── admin.js
│   ├── shop.js
│   ├── cart.js
│   └── user.js
├── utils/               # Helper functions
│   ├── password.js     # Password utilities
│   └── email.js        # Email utilities
├── views/               # EJS templates
│   ├── auth/           # Login/Register pages
│   ├── shop/           # Shop pages
│   ├── admin/          # Admin pages
│   ├── user/           # User pages
│   └── partials/       # Reusable components
├── schema.sql          # Database schema
├── server.js           # Main application
├── SETUP.md            # Setup instructions
└── package.json        # Dependencies
```

## Quick Start

### Prerequisites
- Node.js v14+
- MySQL 5.7+
- npm or yarn

### Installation

1. **Clone or extract the project**
```bash
cd bookverse
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup database**
```bash
mysql -u root -p < schema.sql
```

4. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

5. **Start the server**
```bash
npm run dev    # Development with auto-reload
npm start      # Production
```

6. **Access the application**
Open browser and go to `http://localhost:3000`

## Key Workflows

### User Registration Flow
1. User fills registration form
2. Validates password strength
3. Completes reCAPTCHA
4. Submits registration
5. Password hashed and stored in database
6. Initial password added to history
7. User redirected to login

### Login & 2FA Flow
1. User enters email and password
2. Credentials verified against database
3. OTP generated and sent to email
4. User enters OTP
5. OTP validated
6. Session created
7. User redirected to dashboard

### Admin Book Management
1. Admin accesses `/admin/books`
2. Selects "Add Book" option
3. Fills book details (title, author, price, etc.)
4. Uploads book cover image
5. Submits form
6. Book saved to database
7. Can edit or delete existing books

### Shopping Flow
1. User browses books
2. Selects book to view details
3. Chooses quantity
4. Adds to cart
5. Proceeds to checkout
6. Enters delivery address
7. Completes payment (ready for integration)
8. Order created and saved

## Database Schema

### Tables
- **users** - User accounts with role management
- **password_history** - Track previous passwords
- **categories** - Book categories
- **books** - Book inventory and details
- **cart** - Shopping cart items
- **orders** - Order records
- **order_items** - Individual items in orders
- **otps** - One-time passwords for 2FA

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login
- `GET /verify-otp` - OTP verification page
- `POST /verify-otp` - Verify OTP
- `GET /logout` - Logout user

### Shop
- `GET /shop` - Home page
- `GET /shop/books` - Browse books
- `GET /shop/book/:id` - Book details

### Cart
- `GET /cart` - View cart
- `POST /cart/add` - Add to cart
- `POST /cart/update` - Update quantity
- `POST /cart/remove` - Remove from cart

### Admin
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/books` - Manage books
- `POST /admin/books/add` - Add book
- `POST /admin/books/edit/:id` - Update book
- `DELETE /admin/books/:id` - Delete book
- `GET /admin/orders` - View orders

### User
- `GET /user/dashboard` - User dashboard
- `GET /user/orders` - Order history

## Security Features

1. **Password Security**
   - Minimum 8 characters
   - Must contain uppercase, lowercase, number, special character
   - Hashed with bcrypt (salt rounds: 10)
   - Expires after 90 days
   - History prevents reuse

2. **Authentication**
   - Email/password login
   - OTP verification for additional security
   - Session-based with HTTP-only cookies
   - CSRF protection via session tokens

3. **Data Protection**
   - Parameterized SQL queries (prevent SQL injection)
   - Input validation and sanitization
   - XSS protection via EJS templating
   - CORS configured for security

4. **User Privacy**
   - Role-based access control
   - Users can only access their own data
   - Admin-only protected routes

## Environment Variables

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=bookverse
DB_PORT=3306

PORT=3000
NODE_ENV=development
SESSION_SECRET=secure-session-key

EMAIL_USER=email@gmail.com
EMAIL_PASSWORD=app-password

RECAPTCHA_SITE_KEY=your-site-key
RECAPTCHA_SECRET_KEY=your-secret-key
```

## Customization

### Adding Categories
Edit in `schema.sql` or add via database:
```sql
INSERT INTO categories (name, description) VALUES ('New Category', 'Description');
```

### Styling
- Main styles: `public/css/style.css`
- Auth styles: `public/css/auth.css`
- Uses Bootstrap 5 and custom CSS

### Email Template
Customize in `utils/email.js` - HTML email templates for OTP and notifications

## Future Enhancements

- [ ] Payment gateway integration (Stripe/PayPal)
- [ ] Email notifications for orders
- [ ] Book ratings and reviews
- [ ] Wishlist functionality
- [ ] Invoice generation
- [ ] Admin email notifications
- [ ] Book recommendations
- [ ] Order tracking
- [ ] Advanced search with filters
- [ ] Multi-language support

## Troubleshooting

**MySQL Connection Error**
- Ensure MySQL service is running
- Verify credentials in `.env`
- Check if database exists

**Email Not Sending**
- Verify email credentials
- Use app-specific password for Gmail
- Check email service configuration

**reCAPTCHA Error**
- Verify keys match
- Check domain configuration
- Clear browser cache

**File Upload Issues**
- Ensure `public/uploads/books` exists
- Check file permissions (777)
- Verify disk space

## License

MIT License - Feel free to use and modify for your projects.

## Support

For issues, questions, or feature requests, contact: info@bookverse.com

---

**Version:** 1.0.0  
**Built with:** Node.js, Express, MySQL, Bootstrap  
**Last Updated:** 2024
