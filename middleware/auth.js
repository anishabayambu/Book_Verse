// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login');
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session.userId && req.session.role === 'admin') {
    return next();
  }
  res.status(403).render('403', { title: 'Access Denied' });
};

// Check if user is regular user
const isUser = (req, res, next) => {
  if (req.session.userId && req.session.role === 'user') {
    return next();
  }
  res.status(403).render('403', { title: 'Access Denied' });
};

// Check if already logged in (redirect to home if already authenticated)
const isNotAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return next();
  }
  res.redirect('/');
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isUser,
  isNotAuthenticated
};
