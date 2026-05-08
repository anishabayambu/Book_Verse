const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware - Order matters! Multer should handle multipart before express.urlencoded
app.use(express.json({ limit: '10mb' }));
// Only parse URL-encoded for non-multipart requests
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'bookverse-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to pass session data to all views
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.session.userId;
  res.locals.username = req.session.username || null;
  res.locals.role = req.session.role || null;
  res.locals.userId = req.session.userId || null;
  res.locals.email = req.session.email || null;
  next();
});

// Routes
app.use('/', require('./routes/auth.js'));
app.use('/admin', require('./routes/admin.js'));
app.use('/user', require('./routes/user.js'));
app.use('/shop', require('./routes/shop.js'));
app.use('/cart', require('./routes/cart.js'));

// 404 error handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', { title: 'Server Error', error: err.message });
});

const PORT = parseInt(process.env.PORT || 3000);

function startServer(port) {
  const server = app.listen(port, '0.0.0.0');

  server.once('listening', () => {
    console.log(`BookVerse server running on http://localhost:${port}`);
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
