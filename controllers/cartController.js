const pool = require('../config/database');

// Get cart
const getCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const connection = await pool.getConnection();
    const [cartItems] = await connection.query(
      'SELECT c.id as cartId, b.id, b.title, b.author, b.price, b.cover_image, c.quantity, (b.price * c.quantity) as subtotal FROM cart c JOIN books b ON c.book_id = b.id WHERE c.user_id = ? ORDER BY c.added_at DESC',
      [req.session.userId]
    );

    let totalPrice = 0;
    cartItems.forEach(item => {
      totalPrice += parseFloat(item.subtotal);
    });

    connection.release();

    res.render('shop/cart', {
      title: 'Shopping Cart - BookVerse',
      cartItems,
      totalPrice: totalPrice.toFixed(2),
      isAuthenticated: true,
      username: req.session.username,
      error: null
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Add to cart (API)
const addToCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login to add items to cart.'
      });
    }

    const { bookId, quantity } = req.body;

    if (!bookId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book or quantity.'
      });
    }

    const connection = await pool.getConnection();

    // Check if book exists and has stock
    const [books] = await connection.query(
      'SELECT stock FROM books WHERE id = ?',
      [bookId]
    );

    if (books.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Book not found.'
      });
    }

    if (books[0].stock < quantity) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Not enough stock available.'
      });
    }

    // Check if already in cart
    const [existingCart] = await connection.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND book_id = ?',
      [req.session.userId, bookId]
    );

    if (existingCart.length > 0) {
      // Update quantity
      const newQuantity = existingCart[0].quantity + parseInt(quantity);
      if (newQuantity > books[0].stock) {
        connection.release();
        return res.status(400).json({
          success: false,
          message: 'Not enough stock available.'
        });
      }

      await connection.query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQuantity, existingCart[0].id]
      );
    } else {
      // Add new item
      await connection.query(
        'INSERT INTO cart (user_id, book_id, quantity) VALUES (?, ?, ?)',
        [req.session.userId, bookId, quantity]
      );
    }

    // Get updated cart count
    const [cartCount] = await connection.query(
      'SELECT COUNT(*) as count FROM cart WHERE user_id = ?',
      [req.session.userId]
    );

    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Book added to cart.',
      cartCount: cartCount[0].count
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add to cart.'
    });
  }
};

// Update cart item quantity
const updateCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login.'
      });
    }

    const { cartId, quantity } = req.body;

    if (!cartId || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid cart item or quantity.'
      });
    }

    const connection = await pool.getConnection();

    // Verify cart item belongs to user
    const [cartItems] = await connection.query(
      'SELECT book_id FROM cart WHERE id = ? AND user_id = ?',
      [cartId, req.session.userId]
    );

    if (cartItems.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    // Check stock
    const [books] = await connection.query(
      'SELECT stock FROM books WHERE id = ?',
      [cartItems[0].book_id]
    );

    if (books[0].stock < quantity) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Not enough stock available.'
      });
    }

    // Update quantity
    await connection.query(
      'UPDATE cart SET quantity = ? WHERE id = ?',
      [quantity, cartId]
    );

    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Cart updated.'
    });
  } catch (error) {
    console.error('Update cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cart.'
    });
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        success: false,
        message: 'Please login.'
      });
    }

    const { cartId } = req.body;

    const connection = await pool.getConnection();

    // Verify cart item belongs to user and delete
    const [result] = await connection.query(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [cartId, req.session.userId]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart.'
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove from cart.'
    });
  }
};

// Get checkout page
const getCheckout = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const connection = await pool.getConnection();
    
    // Get cart items
    const [cartItems] = await connection.query(
      'SELECT c.id as cartId, b.id, b.title, b.author, b.price, b.cover_image, c.quantity, (b.price * c.quantity) as subtotal FROM cart c JOIN books b ON c.book_id = b.id WHERE c.user_id = ? ORDER BY c.added_at DESC',
      [req.session.userId]
    );

    if (cartItems.length === 0) {
      connection.release();
      return res.redirect('/cart');
    }

    // Get user info
    const [users] = await connection.query(
      'SELECT email, phone FROM users WHERE id = ?',
      [req.session.userId]
    );

    let totalPrice = 0;
    cartItems.forEach(item => {
      totalPrice += parseFloat(item.subtotal);
    });

    connection.release();

    res.render('shop/checkout', {
      title: 'Checkout - BookVerse',
      cartItems,
      totalPrice: totalPrice.toFixed(2),
      userEmail: users[0]?.email || '',
      userPhone: users[0]?.phone || '',
      isAuthenticated: true,
      username: req.session.username,
      error: null
    });
  } catch (error) {
    console.error('Get checkout error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Process checkout
const postCheckout = async (req, res) => {
  let connection = null;
  try {
    console.log('[v0] Checkout POST - User ID:', req.session.userId);
    console.log('[v0] Checkout POST - Body:', req.body);
    
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const { fullName, email, phone, address, city, zipCode, paymentMethod } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !address || !city || !zipCode || !paymentMethod) {
      console.log('[v0] Missing fields validation failed');
      return res.status(400).render('shop/checkout', {
        title: 'Checkout - BookVerse',
        cartItems: [],
        totalPrice: '0.00',
        userEmail: email,
        userPhone: phone,
        error: 'All required fields must be filled.',
        isAuthenticated: true,
        username: req.session.username
      });
    }

    connection = await pool.getConnection();

    // Get cart items
    console.log('[v0] Getting cart items for user:', req.session.userId);
    const [cartItems] = await connection.query(
      'SELECT c.id as cartId, b.id, b.price, c.quantity, (b.price * c.quantity) as subtotal FROM cart c JOIN books b ON c.book_id = b.id WHERE c.user_id = ?',
      [req.session.userId]
    );

    console.log('[v0] Cart items found:', cartItems.length);

    if (cartItems.length === 0) {
      connection.release();
      return res.redirect('/cart');
    }

    // Calculate total
    let totalAmount = 0;
    cartItems.forEach(item => {
      totalAmount += parseFloat(item.subtotal);
    });

    console.log('[v0] Total amount calculated:', totalAmount);

    // Create order
    console.log('[v0] Creating order with address:', `${address}, ${city} - ${zipCode}`);
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, total_amount, order_status, delivery_address, phone_number) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, totalAmount, 'pending', `${address}, ${city} - ${zipCode}`, phone]
    );

    const orderId = orderResult.insertId;
    console.log('[v0] Order created with ID:', orderId);

    // Add order items
    for (const item of cartItems) {
      console.log('[v0] Adding order item:', item);
      await connection.query(
        'INSERT INTO order_items (order_id, book_id, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.id, item.quantity, item.price, item.subtotal]
      );

      // Update book stock
      await connection.query(
        'UPDATE books SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.id]
      );
    }

    console.log('[v0] All order items added, clearing cart');

    // Clear cart
    await connection.query(
      'DELETE FROM cart WHERE user_id = ?',
      [req.session.userId]
    );

    connection.release();

    console.log('[v0] Checkout completed successfully');

    // Return success response with order details
    return res.status(200).render('shop/order-success', {
      title: 'Order Placed Successfully - BookVerse',
      orderId: orderId,
      totalAmount: totalAmount.toFixed(2),
      paymentMethod: paymentMethod,
      isAuthenticated: true,
      username: req.session.username
    });
  } catch (error) {
    console.error('[v0] Checkout error:', error.message);
    console.error('[v0] Error stack:', error.stack);
    if (connection) connection.release();
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  getCheckout,
  postCheckout
};
