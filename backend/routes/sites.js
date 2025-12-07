const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all sites with latest readings
// @route   GET /api/sites
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        r.water_level as latest_reading,
        r.reading_time as latest_reading_time,
        r.operator_name as latest_operator,
        CASE 
          WHEN r.reading_time IS NULL THEN 'no_data'
          WHEN r.reading_time < NOW() - INTERVAL '24 hours' THEN 'stale'
          WHEN s.critical_level IS NOT NULL AND r.water_level >= s.critical_level THEN 'critical'
          WHEN s.warning_level IS NOT NULL AND r.water_level >= s.warning_level THEN 'warning'
          ELSE 'normal'
        END as status
      FROM sites s
      LEFT JOIN LATERAL (
        SELECT water_level, reading_time, operator_name
        FROM readings 
        WHERE site_id = s.id 
        ORDER BY reading_time DESC 
        LIMIT 1
      ) r ON true
      WHERE s.is_active = true
      ORDER BY s.name
    `;

    const result = await pool.query(query);
    res.json({ sites: result.rows });

  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ message: 'Failed to fetch sites' });
  }
});

// @desc    Get single site with readings
// @route   GET /api/sites/:id
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get site details
    const siteQuery = `
      SELECT s.*, 
        COUNT(r.id) as total_readings,
        MAX(r.reading_time) as latest_reading_time,
        MIN(r.reading_time) as first_reading_time
      FROM sites s
      LEFT JOIN readings r ON s.id = r.site_id
      WHERE s.id = $1 AND s.is_active = true
      GROUP BY s.id
    `;

    const siteResult = await pool.query(siteQuery, [id]);

    if (siteResult.rows.length === 0) {
      return res.status(404).json({ message: 'Site not found' });
    }

    const site = siteResult.rows[0];

    // Get recent readings (last 7 days or 50 readings, whichever is more recent)
    const readingsQuery = `
      SELECT id, water_level, operator_name, reading_time, notes, photo_url
      FROM readings
      WHERE site_id = $1
      ORDER BY reading_time DESC
      LIMIT 50
    `;

    const readingsResult = await pool.query(readingsQuery, [id]);

    res.json({
      site,
      readings: readingsResult.rows
    });

  } catch (error) {
    console.error('Get site error:', error);
    res.status(500).json({ message: 'Failed to fetch site details' });
  }
});

// @desc    Create new site
// @route   POST /api/sites
// @access  Admin only
router.post('/', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const {
      site_id,
      name,
      description,
      latitude,
      longitude,
      elevation,
      warning_level,
      critical_level
    } = req.body;

    // Validate required fields
    if (!site_id || !name || !latitude || !longitude) {
      return res.status(400).json({
        message: 'site_id, name, latitude, and longitude are required'
      });
    }

    // Check if site_id already exists
    const existingQuery = 'SELECT id FROM sites WHERE site_id = $1';
    const existingResult = await pool.query(existingQuery, [site_id]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ message: 'Site ID already exists' });
    }

    const insertQuery = `
      INSERT INTO sites 
      (site_id, name, description, latitude, longitude, location, elevation, warning_level, critical_level, created_by)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      site_id,
      name,
      description,
      latitude,
      longitude,
      longitude, // for ST_MakePoint (longitude first)
      latitude,  // for ST_MakePoint
      elevation,
      warning_level,
      critical_level,
      req.user.id
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      message: 'Site created successfully',
      site: result.rows[0]
    });

  } catch (error) {
    console.error('Create site error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Site with this ID already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create site' });
    }
  }
});

// @desc    Update site
// @route   PUT /api/sites/:id
// @access  Admin only
router.put('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      site_id,
      name,
      description,
      latitude,
      longitude,
      elevation,
      warning_level,
      critical_level,
      is_active
    } = req.body;

    // Check if site exists
    const existingQuery = 'SELECT id FROM sites WHERE id = $1';
    const existingResult = await pool.query(existingQuery, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Site not found' });
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

    addField('site_id', site_id);
    addField('name', name);
    addField('description', description);
    addField('latitude', latitude);
    addField('longitude', longitude);
    addField('elevation', elevation);
    addField('warning_level', warning_level);
    addField('critical_level', critical_level);
    addField('is_active', is_active);

    // Update location if latitude or longitude changed
    if (latitude !== undefined && longitude !== undefined) {
      updateFields.push(`location = ST_SetSRID(ST_MakePoint($${paramCount}, $${paramCount + 1}), 4326)`);
      values.push(longitude, latitude);
      paramCount += 2;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE sites 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    res.json({
      message: 'Site updated successfully',
      site: result.rows[0]
    });

  } catch (error) {
    console.error('Update site error:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ message: 'Site ID already exists' });
    } else {
      res.status(500).json({ message: 'Failed to update site' });
    }
  }
});

// @desc    Delete site
// @route   DELETE /api/sites/:id
// @access  Admin only
router.delete('/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE sites SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Site not found' });
    }

    res.json({
      message: 'Site deactivated successfully',
      site: result.rows[0]
    });

  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({ message: 'Failed to delete site' });
  }
});

module.exports = router;