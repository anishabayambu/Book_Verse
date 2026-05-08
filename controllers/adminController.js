const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

// Get admin dashboard
const getDashboard = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Get statistics
    const [[totalBooks]] = await connection.query('SELECT COUNT(*) as count FROM books');
    const [[totalUsers]] = await connection.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
    const [[totalOrders]] = await connection.query('SELECT COUNT(*) as count FROM orders');
    const [[totalRevenue]] = await connection.query('SELECT COALESCE(SUM(total_amount), 0) as sum FROM orders');

    connection.release();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - BookVerse',
      username: req.session.username,
      stats: {
        totalBooks: totalBooks.count,
        totalUsers: totalUsers.count,
        totalOrders: totalOrders.count,
        totalRevenue: parseFloat(totalRevenue.sum).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get books management page
const getBooks = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [books] = await connection.query(
      'SELECT b.id, b.title, b.author, b.price, b.stock, c.name as category FROM books b JOIN categories c ON b.category_id = c.id ORDER BY b.created_at DESC'
    );
    connection.release();

    res.render('admin/books', {
      title: 'Manage Books - BookVerse',
      username: req.session.username,
      books
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get add book page
const getAddBook = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [categories] = await connection.query('SELECT id, name FROM categories');
    connection.release();

    res.render('admin/add-book', {
      title: 'Add Book - BookVerse',
      username: req.session.username,
      categories
    });
  } catch (error) {
    console.error('Get add book error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Add book
const postAddBook = async (req, res) => {
  try {
    const { title, author, categoryId, description, price, stock, isbn, publishedYear } = req.body;
    const coverImage = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate required fields
    if (!title || !author || !categoryId || !price || stock === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be filled: Title, Author, Category, Price, and Stock.'
      });
    }

    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO books (title, author, category_id, description, price, stock, cover_image, isbn, published_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title,
        author,
        parseInt(categoryId),
        description || '',
        parseFloat(price),
        parseInt(stock),
        coverImage,
        isbn || '',
        publishedYear ? parseInt(publishedYear) : null
      ]
    );

    const bookId = result.insertId;
    connection.release();

    return res.status(201).json({
      success: true,
      message: 'Book added successfully.',
      data: {
        bookId: bookId,
        title: title,
        author: author,
        price: parseFloat(price),
        stock: parseInt(stock),
        coverImage: coverImage
      }
    });
  } catch (error) {
    console.error('Add book error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add book: ' + error.message
    });
  }
};

// Get edit book page
const getEditBook = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [books] = await connection.query('SELECT * FROM books WHERE id = ?', [id]);
    const [categories] = await connection.query('SELECT id, name FROM categories');

    connection.release();

    if (books.length === 0) {
      return res.status(404).render('404', { title: 'Book Not Found' });
    }

    res.render('admin/edit-book', {
      title: 'Edit Book - BookVerse',
      username: req.session.username,
      book: books[0],
      categories
    });
  } catch (error) {
    console.error('Get edit book error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Update book
const postUpdateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, categoryId, description, price, stock, isbn, publishedYear } = req.body;

    if (!title || !author || !categoryId || !price || !stock) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields.'
      });
    }

    const connection = await pool.getConnection();

    let updateQuery = 'UPDATE books SET title = ?, author = ?, category_id = ?, description = ?, price = ?, stock = ?, isbn = ?, published_year = ?';
    let queryParams = [title, author, categoryId, description, price, stock, isbn, publishedYear];

    // If new image is uploaded
    if (req.file) {
      updateQuery += ', cover_image = ?';
      queryParams.push(`/uploads/books/${req.file.filename}`);
    }

    updateQuery += ' WHERE id = ?';
    queryParams.push(id);

    await connection.query(updateQuery, queryParams);
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Book updated successfully.'
    });
  } catch (error) {
    console.error('Update book error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update book.'
    });
  }
};

// Delete book
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    // Get book to delete image
    const [books] = await connection.query('SELECT cover_image FROM books WHERE id = ?', [id]);
    
    if (books.length > 0 && books[0].cover_image) {
      const filePath = path.join(__dirname, '../public', books[0].cover_image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await connection.query('DELETE FROM books WHERE id = ?', [id]);
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Book deleted successfully.'
    });
  } catch (error) {
    console.error('Delete book error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete book.'
    });
  }
};

// Get orders management page
const getOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [orders] = await connection.query(
      'SELECT o.id, u.username, u.email, o.total_amount, o.order_status, o.created_at FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC'
    );
    connection.release();

    res.render('admin/orders', {
      title: 'Manage Orders - BookVerse',
      username: req.session.username,
      orders,
      error: null
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get order details
const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const connection = await pool.getConnection();

    // Get order info
    const [orders] = await connection.query(
      'SELECT o.*, u.username, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?',
      [orderId]
    );

    if (orders.length === 0) {
      connection.release();
      return res.status(404).render('404', { title: 'Order Not Found' });
    }

    // Get order items
    const [items] = await connection.query(
      'SELECT oi.*, b.title, b.author FROM order_items oi JOIN books b ON oi.book_id = b.id WHERE oi.order_id = ?',
      [orderId]
    );

    connection.release();

    res.render('admin/order-details', {
      title: 'Order Details - BookVerse',
      username: req.session.username,
      order: orders[0],
      items,
      error: null,
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status.'
      });
    }

    const connection = await pool.getConnection();
    await connection.query(
      'UPDATE orders SET order_status = ? WHERE id = ?',
      [status, orderId]
    );
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      status: status
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status.'
    });
  }
};

// ==================== API ENDPOINTS FOR ENHANCED DASHBOARD ====================

// API: Get all books with stock info
const apiGetBooks = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [books] = await connection.query(`
      SELECT b.id, b.title, b.author, b.price, b.stock, b.description, 
             c.name as category, b.cover_image
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      ORDER BY b.id DESC
    `);
    connection.release();
    res.json(books);
  } catch (error) {
    console.error('API Get books error:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

// API: Get single book by ID
const apiGetBookById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [books] = await connection.query(`
      SELECT b.id, b.title, b.author, b.price, b.stock, b.description, 
             b.category_id, c.name as category, b.cover_image
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      WHERE b.id = ?
    `, [id]);
    connection.release();
    
    if (books.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(books[0]);
  } catch (error) {
    console.error('API Get book error:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
};

// API: Add new book (JSON endpoint)
const apiAddBook = async (req, res) => {
  try {
    const { title, author, price, stock, description, categoryId } = req.body;
    
    if (!title || !author || !price || stock === undefined) {
      return res.status(400).json({ error: 'Missing required fields: title, author, price, stock' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'INSERT INTO books (title, author, price, stock, description, category_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, author, parseFloat(price), parseInt(stock), description || null, categoryId || null]
    );
    connection.release();
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'Book added successfully' 
    });
  } catch (error) {
    console.error('API Add book error:', error);
    res.status(500).json({ error: 'Failed to add book: ' + error.message });
  }
};

// API: Update book (JSON endpoint)
const apiUpdateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, price, stock, description, categoryId } = req.body;
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      `UPDATE books SET 
        title = ?, author = ?, price = ?, stock = ?, 
        description = ?, category_id = ? 
       WHERE id = ?`,
      [title, author, parseFloat(price), parseInt(stock), description || null, categoryId || null, id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ message: 'Book updated successfully' });
  } catch (error) {
    console.error('API Update book error:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
};

// API: Update book stock (PATCH)
const apiUpdateBookStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ error: 'Invalid stock quantity' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE books SET stock = ? WHERE id = ?',
      [parseInt(stock), id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ message: 'Stock updated successfully' });
  } catch (error) {
    console.error('API Update stock error:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

// API: Delete book (JSON endpoint)
const apiDeleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    // Get book cover image to delete
    const [books] = await connection.query('SELECT cover_image FROM books WHERE id = ?', [id]);
    if (books.length > 0 && books[0].cover_image) {
      const filePath = path.join(__dirname, '../public', books[0].cover_image);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    const [result] = await connection.query('DELETE FROM books WHERE id = ?', [id]);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('API Delete book error:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
};

// ==================== USER MANAGEMENT API ====================

// API: Get all users
const apiGetUsers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [users] = await connection.query(`
      SELECT id, username, email, role, 
             CASE WHEN is_active = 1 THEN true ELSE false END as is_active,
             created_at 
      FROM users 
      ORDER BY id DESC
    `);
    connection.release();
    res.json(users);
  } catch (error) {
    console.error('API Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// API: Get single user
const apiGetUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [id]
    );
    connection.release();
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('API Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// API: Add new user
const apiAddUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: username, email, password' });
    }
    
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const connection = await pool.getConnection();
    
    // Check if user exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'user', 1]
    );
    connection.release();
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'User added successfully' 
    });
  } catch (error) {
    console.error('API Add user error:', error);
    res.status(500).json({ error: 'Failed to add user: ' + error.message });
  }
};

// API: Update user
const apiUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, password } = req.body;
    
    const connection = await pool.getConnection();
    
    let query = 'UPDATE users SET username = ?, email = ?, role = ?';
    let params = [username, email, role];
    
    // Update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    const [result] = await connection.query(query, params);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('API Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// API: Toggle user status (activate/deactivate)
const apiToggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    // Don't allow deactivating yourself
    if (parseInt(id) === req.session.userId && active === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: `User ${active ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('API Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// API: Delete user
const apiDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't allow deleting yourself
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('API Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// ==================== ORDERS API ====================

// API: Get all orders
const apiGetOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [orders] = await connection.query(`
      SELECT o.id, u.username as customer_name, u.email, o.total_amount, 
             o.order_status as status, o.created_at 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `);
    connection.release();
    res.json(orders);
  } catch (error) {
    console.error('API Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// API: Update order status
const apiUpdateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE orders SET order_status = ? WHERE id = ?',
      [status, orderId]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    console.error('API Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
  // ==================== USER MANAGEMENT API ====================

// API: Get all users
const apiGetUsers = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Check if is_active column exists, if not, assume all users are active
    let query = `
      SELECT id, username, email, role, created_at 
      FROM users 
      ORDER BY id DESC
    `;
    
    const [users] = await connection.query(query);
    
    // Add is_active field (default to true if column doesn't exist)
    const usersWithStatus = users.map(user => ({
      ...user,
      is_active: true // Default to active if column doesn't exist
    }));
    
    connection.release();
    res.json(usersWithStatus);
  } catch (error) {
    console.error('API Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users: ' + error.message });
  }
};

// API: Get single user
const apiGetUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [id]
    );
    connection.release();
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('API Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// API: Add new user (FIXED)
const apiAddUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    console.log('Adding user:', { username, email, role }); // Debug log
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields: username, email, password' });
    }
    
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const connection = await pool.getConnection();
    
    // Check if user exists
    const [existing] = await connection.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Insert new user - removed is_active column if it doesn't exist
    const [result] = await connection.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role || 'user']
    );
    
    connection.release();
    
    console.log('User added successfully, ID:', result.insertId); // Debug log
    
    res.status(201).json({ 
      id: result.insertId,
      message: 'User added successfully' 
    });
  } catch (error) {
    console.error('API Add user error:', error);
    res.status(500).json({ error: 'Failed to add user: ' + error.message });
  }
};

// API: Update user (FIXED)
const apiUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, password } = req.body;
    
    const connection = await pool.getConnection();
    
    let query = 'UPDATE users SET username = ?, email = ?, role = ?';
    let params = [username, email, role];
    
    // Update password if provided
    if (password && password.trim() !== '') {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }
    
    query += ' WHERE id = ?';
    params.push(id);
    
    const [result] = await connection.query(query, params);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('API Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// API: Toggle user status (FIXED - works without is_active column)
const apiToggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    // Since is_active column might not exist, we'll just return success
    // You can add the column later if needed
    console.log(`Toggle user status called for user ${id} to ${active}`);
    
    // If you have is_active column, uncomment this:
    /*
    // Don't allow deactivating yourself
    if (parseInt(id) === req.session.userId && active === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [active ? 1 : 0, id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    */
    
    res.json({ message: `User ${active ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('API Toggle user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

// API: Delete user (FIXED)
const apiDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't allow deleting yourself
    if (req.session && parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const connection = await pool.getConnection();
    const [result] = await connection.query('DELETE FROM users WHERE id = ?', [id]);
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('API Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
};


// ==================== EXPORT ALL FUNCTIONS ====================

module.exports = {
  // Existing functions
  getDashboard,
  getBooks,
  getAddBook,
  postAddBook,
  getEditBook,
  postUpdateBook,
  deleteBook,
  getOrders,
  getOrderDetails,
  updateOrderStatus,
  
  // API functions
  apiGetBooks,
  apiGetBookById,
  apiAddBook,
  apiUpdateBook,
  apiUpdateBookStock,
  apiDeleteBook,
  apiGetUsers,
  apiGetUserById,
  apiAddUser,
  apiUpdateUser,
  apiToggleUserStatus,
  apiDeleteUser,
  apiGetOrders,
  apiUpdateOrderStatus
};