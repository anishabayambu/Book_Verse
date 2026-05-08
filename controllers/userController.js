const pool = require('../config/database');

// Get user dashboard
const getDashboard = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Get recent orders (last 5)
    const [orders] = await connection.query(
      'SELECT id, total_amount, order_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.session.userId]
    );

    connection.release();

    res.render('user/dashboard', {
      title: 'User Dashboard - BookVerse',
      username: req.session.username,
      email: req.session.email,
      orders,
      isAuthenticated: true,
      error: null
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get user orders
const getOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const [orders] = await connection.query(
      'SELECT id, total_amount, order_status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );

    connection.release();

    res.render('user/orders', {
      title: 'My Orders - BookVerse',
      username: req.session.username,
      orders,
      isAuthenticated: true,
      error: null
    });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const connection = await pool.getConnection();

    // Get order
    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [orderId, req.session.userId]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).render('404', { title: 'Order Not Found' });
    }

    // Get order items
    const [items] = await connection.query(
      'SELECT oi.*, b.title, b.author, b.cover_image FROM order_items oi JOIN books b ON oi.book_id = b.id WHERE oi.order_id = ?',
      [orderId]
    );

    connection.release();

    res.render('user/order-details', {
      title: 'Order Details - BookVerse',
      username: req.session.username,
      order: orders[0],
      items,
      isAuthenticated: true,
      error: null
    });
  } catch (error) {
    console.error('Order details error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

module.exports = {
  getDashboard,
  getOrders,
  getOrderDetails
};
