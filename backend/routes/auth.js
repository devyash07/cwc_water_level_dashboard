const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// @desc    User login
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    if (!username && !email) {
      return res.status(400).json({ message: 'Username or email is required' });
    }

    // Find user by username or email
    let query, params;
    if (username) {
      query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
      params = [username];
    } else {
      query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
      params = [email];
    }

    const userResult = await pool.query(query, params);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.hashed_password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = generateToken(user);

    // Store session (optional, for logout functionality)
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, token.substring(0, 50), new Date(Date.now() + 24 * 60 * 60 * 1000)]
    );

    // Return user info and token (exclude password)
    const { hashed_password, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// @desc    User logout
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Invalidate session
      await pool.query(
        'DELETE FROM sessions WHERE user_id = $1 AND token_hash = $2',
        [req.user.id, token.substring(0, 50)]
      );
    }

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { hashed_password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user information' });
  }
});

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // Generate new token
    const newToken = generateToken(req.user);

    // Update session with new token
    const authHeader = req.headers['authorization'];
    const oldToken = authHeader && authHeader.split(' ')[1];

    if (oldToken) {
      await pool.query(
        'UPDATE sessions SET token_hash = $1, expires_at = $2 WHERE user_id = $3 AND token_hash = $4',
        [newToken.substring(0, 50), new Date(Date.now() + 24 * 60 * 60 * 1000), req.user.id, oldToken.substring(0, 50)]
      );
    }

    res.json({
      message: 'Token refreshed',
      token: newToken
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
});

module.exports = router;