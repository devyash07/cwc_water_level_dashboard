const pool = require('../config/database');

const initDatabase = async () => {
  try {
    console.log('🚀 Initializing database schema...');

    // Enable PostGIS extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✅ PostGIS extension enabled');

    // Add username column to existing users table if it doesn't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
    `);
    console.log('✅ Users table updated with username column');

    // Update sites table with additional columns if needed
    await pool.query(`
      ALTER TABLE sites 
      ADD COLUMN IF NOT EXISTS warning_level DECIMAL(8, 3),
      ADD COLUMN IF NOT EXISTS critical_level DECIMAL(8, 3);
    `);
    console.log('✅ Sites table updated with warning/critical levels');

    // Create spatial index for sites
    await pool.query(`
      CREATE INDEX IF NOT EXISTS sites_location_idx ON sites USING GIST (location);
    `);
    console.log('✅ Spatial index created for sites');

    // Check if readings table has the columns we need
    console.log('✅ Readings table already exists from mobile app');

    // Create index for readings
    await pool.query(`
      CREATE INDEX IF NOT EXISTS readings_site_id_idx ON readings (site_id);
      CREATE INDEX IF NOT EXISTS readings_reading_time_idx ON readings (reading_time DESC);
    `);
    console.log('✅ Indexes created for readings');

    // Create alerts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        reading_id INTEGER REFERENCES readings(id) ON DELETE CASCADE,
        alert_type VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning', 'critical', 'stale_data', 'no_data')),
        message TEXT NOT NULL,
        is_acknowledged BOOLEAN DEFAULT false,
        acknowledged_by INTEGER REFERENCES users(id),
        acknowledged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Alerts table created');

    // Create sessions table for JWT token management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Sessions table created');

    // Create triggers for updating updated_at columns
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    const tables = ['users', 'sites', 'readings'];
    for (const table of tables) {
      await pool.query(`
        DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
        CREATE TRIGGER update_${table}_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);
    }
    console.log('✅ Update triggers created');

    console.log('🎉 Database schema initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

// Insert default admin user
const createDefaultUsers = async () => {
  const bcrypt = require('bcrypt');
  
  try {
    // Check if admin user exists by email (since username might not exist yet)
    const adminExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@cwc.gov.in']
    );

    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(`
        INSERT INTO users (username, email, hashed_password, role, full_name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, ['admin', 'admin@cwc.gov.in', hashedPassword, 'admin', 'System Administrator', true]);
      
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    } else {
      // Update existing user with username if needed
      await pool.query(
        'UPDATE users SET username = $1 WHERE email = $2 AND username IS NULL',
        ['admin', 'admin@cwc.gov.in']
      );
      console.log('ℹ️  Admin user already exists, updated with username');
    }

    // Create sample supervisor
    const supervisorExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['supervisor@cwc.gov.in']
    );

    if (supervisorExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('supervisor123', 10);
      
      await pool.query(`
        INSERT INTO users (username, email, hashed_password, role, full_name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, ['supervisor1', 'supervisor@cwc.gov.in', hashedPassword, 'supervisor', 'Field Supervisor', true]);
      
      console.log('✅ Default supervisor user created (username: supervisor1, password: supervisor123)');
    }

    // Create sample analyst
    const analystExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['analyst@cwc.gov.in']
    );

    if (analystExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('analyst123', 10);
      
      await pool.query(`
        INSERT INTO users (username, email, hashed_password, role, full_name, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, ['analyst1', 'analyst@cwc.gov.in', hashedPassword, 'analyst', 'Data Analyst', true]);
      
      console.log('✅ Default analyst user created (username: analyst1, password: analyst123)');
    }

  } catch (error) {
    console.error('❌ Error creating default users:', error);
    throw error;
  }
};

// Insert sample sites
const createSampleSites = async () => {
  try {
    const siteExists = await pool.query('SELECT id FROM sites LIMIT 1');
    
    if (siteExists.rows.length === 0) {
      const sampleSites = [
        {
          site_id: 'CWC001',
          name: 'Yamuna at Delhi',
          description: 'Water level monitoring at Yamuna River, Delhi',
          latitude: 28.6139,
          longitude: 77.2090,
          warning_level: 204.5,
          critical_level: 206.0
        },
        {
          site_id: 'CWC002', 
          name: 'Ganga at Haridwar',
          description: 'Water level monitoring at Ganga River, Haridwar',
          latitude: 29.9457,
          longitude: 78.1642,
          warning_level: 294.5,
          critical_level: 296.0
        },
        {
          site_id: 'CWC003',
          name: 'Godavari at Nashik',
          description: 'Water level monitoring at Godavari River, Nashik',
          latitude: 19.9975,
          longitude: 73.7898,
          warning_level: 485.0,
          critical_level: 487.5
        }
      ];

      for (const site of sampleSites) {
        await pool.query(`
          INSERT INTO sites (site_id, name, description, latitude, longitude, location, warning_level, critical_level)
          VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326), $8, $9)
        `, [
          site.site_id, site.name, site.description, site.latitude, site.longitude,
          site.longitude, site.latitude, site.warning_level, site.critical_level
        ]);
      }
      
      console.log('✅ Sample sites created');
    } else {
      console.log('ℹ️  Sites already exist');
    }
  } catch (error) {
    console.error('❌ Error creating sample sites:', error);
    throw error;
  }
};

// Run initialization
const runInit = async () => {
  try {
    await initDatabase();
    await createDefaultUsers();
    await createSampleSites();
    console.log('✨ Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database initialization failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  runInit();
}

module.exports = { initDatabase, createDefaultUsers, createSampleSites };