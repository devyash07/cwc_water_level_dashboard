const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all users
// @route   GET /api/users
// @access  Admin only
router.get('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const query = `
      SELECT id, username, email, full_name, role, is_active, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    res.json({ users: result.rows });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Admin only
router.get('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT id, username, email, full_name, role, is_active, phone_number, created_at, last_login
      FROM users
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// @desc    Create new user
// @route   POST /api/users
// @access  Admin only
router.post('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      full_name,
      role,
      phone_number
    } = req.body;

    // Validate required fields
    if (!username || !email || !password || !full_name || !role) {
      return res.status(400).json({
        message: 'username, email, password, full_name, and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'supervisor', 'analyst'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role. Must be: admin, supervisor, or analyst'
      });
    }

    // Check if username or email already exists
    const existingQuery = 'SELECT id FROM users WHERE username = $1 OR email = $2';
    const existingResult = await pool.query(existingQuery, [username, email]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO users (username, email, hashed_password, full_name, role, phone_number, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id, username, email, full_name, role, is_active, phone_number, created_at
    `;

    const values = [username, email, hashedPassword, full_name, role, phone_number];
    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create user' });
    }
  }
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Admin only
router.put('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      full_name,
      role,
      phone_number,
      is_active
    } = req.body;

    // Check if user exists
    const existingQuery = 'SELECT id FROM users WHERE id = $1';
    const existingResult = await pool.query(existingQuery, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'supervisor', 'analyst'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: 'Invalid role. Must be: admin, supervisor, or analyst'
        });
      }
    }

    // Build dynamic update query
    let updateFields = [];
    let values = [];
    let paramCount = 1;

    const addField = (field, value) => {
      if (value !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    };

    addField('username', username);
    addField('email', email);
    addField('full_name', full_name);
    addField('role', role);
    addField('phone_number', phone_number);
    addField('is_active', is_active);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, full_name, role, is_active, phone_number, updated_at
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: 'Failed to update user' });
    }
  }
});

// @desc    Change user password
// @route   PUT /api/users/:id/password
// @access  Admin only
router.put('/:id/password', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

// @desc    Delete user (deactivate)
// @route   DELETE /api/users/:id
// @access  Admin only
router.delete('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const result = await pool.query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, full_name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User deactivated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

module.exports = router;