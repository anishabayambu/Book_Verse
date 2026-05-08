const pool = require('../config/database');

// Get home page
const getHome = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Get featured books (latest 8)
    const [books] = await connection.query(
      'SELECT b.id, b.title, b.author, b.price, b.cover_image, c.name as category FROM books b JOIN categories c ON b.category_id = c.id WHERE b.stock > 0 ORDER BY b.created_at DESC LIMIT 8'
    );

    // Get categories
    const [categories] = await connection.query('SELECT id, name FROM categories');

    connection.release();

    res.render('shop/home', {
      title: 'BookVerse - Online Book Store',
      books,
      categories,
      isAuthenticated: !!req.session.userId,
      username: req.session.username
    });
  } catch (error) {
    console.error('Home error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get all books with filtering and search
const getBooks = async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    const connection = await pool.getConnection();

    let query = 'SELECT b.id, b.title, b.author, b.price, b.cover_image, c.name as category FROM books b JOIN categories c ON b.category_id = c.id WHERE b.stock > 0';
    let queryParams = [];

    if (search) {
      query += ' AND (b.title LIKE ? OR b.author LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      query += ' AND c.id = ?';
      queryParams.push(category);
    }

    if (sort === 'price-low') {
      query += ' ORDER BY b.price ASC';
    } else if (sort === 'price-high') {
      query += ' ORDER BY b.price DESC';
    } else if (sort === 'newest') {
      query += ' ORDER BY b.created_at DESC';
    } else {
      query += ' ORDER BY b.title ASC';
    }

    const [books] = await connection.query(query, queryParams);
    const [categories] = await connection.query('SELECT id, name FROM categories');

    connection.release();

    res.render('shop/books', {
      title: 'Books - BookVerse',
      books,
      categories,
      selectedCategory: category || 'all',
      selectedSort: sort || 'name',
      searchQuery: search || '',
      isAuthenticated: !!req.session.userId,
      username: req.session.username
    });
  } catch (error) {
    console.error('Get books error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

// Get book detail
const getBookDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    const [books] = await connection.query(
      'SELECT b.*, c.name as category FROM books b JOIN categories c ON b.category_id = c.id WHERE b.id = ?',
      [id]
    );

    connection.release();

    if (books.length === 0) {
      return res.status(404).render('404', { title: 'Book Not Found' });
    }

    res.render('shop/book-detail', {
      title: `${books[0].title} - BookVerse`,
      book: books[0],
      isAuthenticated: !!req.session.userId,
      username: req.session.username
    });
  } catch (error) {
    console.error('Get book detail error:', error);
    res.status(500).render('500', { title: 'Error', error: error.message });
  }
};

module.exports = {
  getHome,
  getBooks,
  getBookDetail
};
