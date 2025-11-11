const mysql = require('mysql2');
const util = require('util');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'edulms',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  multipleStatements: true,
  reconnect: true
});

// Promisify for async/await
pool.query = util.promisify(pool.query);
pool.getConnection = util.promisify(pool.getConnection);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.log('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
    console.log('Database connection was refused.');
  }
});

// Initialize database schema
const initializeDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'database-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✅ Database schema initialized successfully');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
};

// Run initialization in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    initializeDatabase();
  }, 2000);
}

module.exports = pool;