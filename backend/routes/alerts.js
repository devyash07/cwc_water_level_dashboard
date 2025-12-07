const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all alerts
// @route   GET /api/alerts
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      acknowledged = 'all', // 'all', 'true', 'false'
      alert_type,
      site_id,
      limit = 50,
      offset = 0
    } = req.query;

    let whereClause = '1=1';
    let queryParams = [];
    let paramCount = 1;

    // Filter by acknowledgment status
    if (acknowledged === 'true') {
      whereClause += ' AND a.is_acknowledged = true';
    } else if (acknowledged === 'false') {
      whereClause += ' AND a.is_acknowledged = false';
    }

    // Filter by alert type
    if (alert_type) {
      whereClause += ` AND a.alert_type = $${paramCount}`;
      queryParams.push(alert_type);
      paramCount++;
    }

    // Filter by site
    if (site_id) {
      whereClause += ` AND a.site_id = $${paramCount}`;
      queryParams.push(site_id);
      paramCount++;
    }

    // Add pagination
    whereClause += ` ORDER BY a.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const query = `
      SELECT 
        a.*,
        s.site_id,
        s.name as site_name,
        s.latitude,
        s.longitude,
        u.full_name as acknowledged_by_name,
        r.water_level,
        r.reading_time
      FROM alerts a
      JOIN sites s ON a.site_id = s.id
      LEFT JOIN users u ON a.acknowledged_by = u.id
      LEFT JOIN readings r ON a.reading_id = r.id
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM alerts a
      JOIN sites s ON a.site_id = s.id
      WHERE ${whereClause.split('ORDER BY')[0]}
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      alerts: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// @desc    Get alert by ID
// @route   GET /api/alerts/:id
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        a.*,
        s.site_id,
        s.name as site_name,
        s.latitude,
        s.longitude,
        u.full_name as acknowledged_by_name,
        r.water_level,
        r.reading_time,
        r.operator_name
      FROM alerts a
      JOIN sites s ON a.site_id = s.id
      LEFT JOIN users u ON a.acknowledged_by = u.id
      LEFT JOIN readings r ON a.reading_id = r.id
      WHERE a.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    res.json({ alert: result.rows[0] });

  } catch (error) {
    console.error('Get alert error:', error);
    res.status(500).json({ message: 'Failed to fetch alert' });
  }
});

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
// @access  Private (Supervisor and Admin)
router.put('/:id/acknowledge', authenticateToken, authorize('supervisor', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE alerts 
       SET is_acknowledged = true, 
           acknowledged_by = $1, 
           acknowledged_at = NOW()
       WHERE id = $2 AND is_acknowledged = false
       RETURNING *`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Alert not found or already acknowledged' });
    }

    // Broadcast acknowledgment to WebSocket clients
    if (req.app.locals.wss) {
      const message = {
        type: 'alert_acknowledged',
        alert_id: id,
        acknowledged_by: req.user.full_name,
        timestamp: new Date().toISOString()
      };

      req.app.locals.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(message));
        }
      });
    }

    res.json({
      message: 'Alert acknowledged successfully',
      alert: result.rows[0]
    });

  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({ message: 'Failed to acknowledge alert' });
  }
});

// @desc    Create alert (typically called by system)
// @route   POST /api/alerts
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      site_id,
      reading_id,
      alert_type,
      message
    } = req.body;

    // Validate required fields
    if (!site_id || !alert_type || !message) {
      return res.status(400).json({
        message: 'site_id, alert_type, and message are required'
      });
    }

    // Check if similar alert already exists (to prevent spam)
    const existingQuery = `
      SELECT id FROM alerts 
      WHERE site_id = $1 
        AND alert_type = $2 
        AND is_acknowledged = false 
        AND created_at > NOW() - INTERVAL '1 hour'
    `;

    const existingResult = await pool.query(existingQuery, [site_id, alert_type]);

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ message: 'Similar alert already exists' });
    }

    const insertQuery = `
      INSERT INTO alerts (site_id, reading_id, alert_type, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [site_id, reading_id, alert_type, message]);

    // Get site details for broadcasting
    const siteQuery = `
      SELECT s.site_id, s.name, s.latitude, s.longitude
      FROM sites s
      WHERE s.id = $1
    `;

    const siteResult = await pool.query(siteQuery, [site_id]);
    const site = siteResult.rows[0];

    const newAlert = {
      ...result.rows[0],
      site_name: site?.name,
      site_latitude: site?.latitude,
      site_longitude: site?.longitude
    };

    // Broadcast new alert to WebSocket clients
    if (req.app.locals.wss) {
      const message = {
        type: 'new_alert',
        alert: newAlert,
        timestamp: new Date().toISOString()
      };

      req.app.locals.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(message));
        }
      });
    }

    res.status(201).json({
      message: 'Alert created successfully',
      alert: newAlert
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ message: 'Failed to create alert' });
  }
});

// @desc    Get alert statistics
// @route   GET /api/alerts/stats
// @access  Private
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const query = `
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN is_acknowledged = false THEN 1 END) as pending_alerts,
        COUNT(CASE WHEN is_acknowledged = true THEN 1 END) as acknowledged_alerts,
        COUNT(CASE WHEN alert_type = 'critical' THEN 1 END) as critical_alerts,
        COUNT(CASE WHEN alert_type = 'warning' THEN 1 END) as warning_alerts,
        COUNT(CASE WHEN alert_type = 'stale_data' THEN 1 END) as stale_data_alerts,
        COUNT(CASE WHEN alert_type = 'no_data' THEN 1 END) as no_data_alerts
      FROM alerts
      WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
    `;

    const result = await pool.query(query);

    res.json({
      statistics: result.rows[0],
      period_days: parseInt(days),
      calculated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get alert stats error:', error);
    res.status(500).json({ message: 'Failed to get alert statistics' });
  }
});

module.exports = router;