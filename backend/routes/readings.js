const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get readings with filtering
// @route   GET /api/readings
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      site_id,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
      order_by = 'reading_time',
      order_dir = 'DESC'
    } = req.query;

    let whereClause = '1=1';
    let queryParams = [];
    let paramCount = 1;

    // Add filters
    if (site_id) {
      whereClause += ` AND r.site_id = $${paramCount}`;
      queryParams.push(site_id);
      paramCount++;
    }

    if (start_date) {
      whereClause += ` AND r.reading_time >= $${paramCount}`;
      queryParams.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereClause += ` AND r.reading_time <= $${paramCount}`;
      queryParams.push(end_date);
      paramCount++;
    }

    // Add pagination
    whereClause += ` ORDER BY r.${order_by} ${order_dir}`;
    whereClause += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const query = `
      SELECT 
        r.*,
        s.site_id,
        s.name as site_name,
        s.warning_level,
        s.critical_level,
        CASE 
          WHEN s.critical_level IS NOT NULL AND r.water_level >= s.critical_level THEN 'critical'
          WHEN s.warning_level IS NOT NULL AND r.water_level >= s.warning_level THEN 'warning'
          ELSE 'normal'
        END as alert_level
      FROM readings r
      JOIN sites s ON r.site_id = s.id
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM readings r
      JOIN sites s ON r.site_id = s.id
      WHERE ${whereClause.split('ORDER BY')[0]}
    `;

    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      readings: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    console.error('Get readings error:', error);
    res.status(500).json({ message: 'Failed to fetch readings' });
  }
});

// @desc    Get reading by ID
// @route   GET /api/readings/:id
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        r.*,
        s.site_id,
        s.name as site_name,
        s.warning_level,
        s.critical_level,
        s.latitude as site_latitude,
        s.longitude as site_longitude
      FROM readings r
      JOIN sites s ON r.site_id = s.id
      WHERE r.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reading not found' });
    }

    res.json({ reading: result.rows[0] });

  } catch (error) {
    console.error('Get reading error:', error);
    res.status(500).json({ message: 'Failed to fetch reading' });
  }
});

// @desc    Get readings for export
// @route   GET /api/readings/export
// @access  Private (Analyst and Admin)
router.get('/export/data', authenticateToken, authorize('analyst', 'admin'), async (req, res) => {
  try {
    const {
      site_ids,
      start_date,
      end_date,
      format = 'json'
    } = req.query;

    let whereClause = '1=1';
    let queryParams = [];
    let paramCount = 1;

    if (site_ids) {
      const siteIdArray = site_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
      if (siteIdArray.length > 0) {
        whereClause += ` AND r.site_id = ANY($${paramCount})`;
        queryParams.push(siteIdArray);
        paramCount++;
      }
    }

    if (start_date) {
      whereClause += ` AND r.reading_time >= $${paramCount}`;
      queryParams.push(start_date);
      paramCount++;
    }

    if (end_date) {
      whereClause += ` AND r.reading_time <= $${paramCount}`;
      queryParams.push(end_date);
      paramCount++;
    }

    const query = `
      SELECT 
        s.site_id,
        s.name as site_name,
        r.water_level,
        r.operator_name,
        r.reading_time,
        r.notes,
        s.latitude,
        s.longitude,
        s.warning_level,
        s.critical_level
      FROM readings r
      JOIN sites s ON r.site_id = s.id
      WHERE ${whereClause}
      ORDER BY r.reading_time DESC
    `;

    const result = await pool.query(query, queryParams);

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Site ID,Site Name,Water Level,Operator,Reading Time,Notes,Latitude,Longitude,Warning Level,Critical Level\n';
      const csvData = result.rows.map(row => {
        const values = [
          row.site_id,
          `"${row.site_name}"`,
          row.water_level,
          `"${row.operator_name}"`,
          row.reading_time,
          `"${row.notes || ''}"`,
          row.latitude,
          row.longitude,
          row.warning_level || '',
          row.critical_level || ''
        ];
        return values.join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="water_readings_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvHeader + csvData);

    } else {
      res.json({
        readings: result.rows,
        exported_at: new Date().toISOString(),
        total: result.rows.length
      });
    }

  } catch (error) {
    console.error('Export readings error:', error);
    res.status(500).json({ message: 'Failed to export readings' });
  }
});

// @desc    Get readings statistics
// @route   GET /api/readings/stats
// @access  Private
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { site_id, days = 7 } = req.query;

    let whereClause = `r.reading_time >= NOW() - INTERVAL '${parseInt(days)} days'`;
    let queryParams = [];

    if (site_id) {
      whereClause += ' AND r.site_id = $1';
      queryParams.push(site_id);
    }

    const query = `
      SELECT 
        COUNT(*) as total_readings,
        COUNT(DISTINCT r.site_id) as active_sites,
        AVG(r.water_level) as avg_water_level,
        MIN(r.water_level) as min_water_level,
        MAX(r.water_level) as max_water_level,
        COUNT(CASE WHEN s.critical_level IS NOT NULL AND r.water_level >= s.critical_level THEN 1 END) as critical_readings,
        COUNT(CASE WHEN s.warning_level IS NOT NULL AND r.water_level >= s.warning_level AND (s.critical_level IS NULL OR r.water_level < s.critical_level) THEN 1 END) as warning_readings
      FROM readings r
      JOIN sites s ON r.site_id = s.id
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, queryParams);

    res.json({
      statistics: result.rows[0],
      period_days: parseInt(days),
      calculated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get readings stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
});

module.exports = router;