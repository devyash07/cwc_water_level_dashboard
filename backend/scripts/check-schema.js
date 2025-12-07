const pool = require('../config/database');

const checkSchema = async () => {
  try {
    // Check existing tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('Existing tables:');
    tables.rows.forEach(row => console.log(`- ${row.table_name}`));

    // Check users table structure if it exists
    const usersExists = tables.rows.some(row => row.table_name === 'users');
    if (usersExists) {
      const usersStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `);
      
      console.log('\nUsers table structure:');
      usersStructure.rows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    }

    // Check if PostGIS is available
    const extensions = await pool.query(`
      SELECT extname FROM pg_extension WHERE extname = 'postgis';
    `);
    
    console.log('\nPostGIS extension:', extensions.rows.length > 0 ? 'Available' : 'Not available');
    
    await pool.end();
    console.log('\n✅ Schema check completed');
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    await pool.end();
    process.exit(1);
  }
};

checkSchema();