const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: isProduction ? 50 : 20,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  multipleStatements: isDevelopment, // Disable in production for security
  reconnect: true,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  
  // Production-specific settings
  ...(isProduction && {
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
  }),
  
  // Development-specific settings
  ...(isDevelopment && {
    debug: false, // Set to true to enable query logging
  })
});

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
  let connection;
  try {
    connection = await pool.getConnection();
    
    const schemaPath = path.join(__dirname, 'database-schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️ No schema file found at:', schemaPath);
      return;
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    // Split by semicolon but be careful with triggers/functions
    const statements = schema.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// Database health check
const checkDatabaseHealth = async () => {
  try {
    const [result] = await pool.query('SELECT 1 as health_check');
    return { healthy: true, timestamp: new Date() };
  } catch (error) {
    return { 
      healthy: false, 
      error: error.message,
      timestamp: new Date()
    };
  }
};

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('🛑 Received shutdown signal, closing database pool...');
  
  try {
    await pool.end();
    console.log('✅ Database pool closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon

// Transaction helper
const transaction = async (callback) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Run initialization in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    initializeDatabase();
  }, 2000);
}

module.exports = {
  pool,
  checkDatabaseHealth,
  initializeDatabase,
  gracefulShutdown,
  transaction
};