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
  multipleStatements: isDevelopment,
  connectTimeout: 60000,
  
  // Production-specific settings
  ...(isProduction && {
    ssl: { rejectUnauthorized: true },
    multipleStatements: false,
  }),
  
  // Development-specific settings
  ...(isDevelopment && {
    debug: false,
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

// Create database schema if it doesn't exist
const createDatabaseSchema = async () => {
  let connection;
  try {
    // Get connection without specific database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    const dbName = process.env.DB_NAME;
    
    // Use regular query instead of execute for schema operations
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database '${dbName}' ensured`);
    
    // Switch to the database using query
    await connection.query(`USE \`${dbName}\``);
    
    // Create tables
    await createTables(connection);
    
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Database schema creation failed:', error);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

// Create all necessary tables using query instead of execute
const createTables = async (connection) => {
  // Users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role_id INT DEFAULT 2,
      phone VARCHAR(20),
      student_id VARCHAR(50) UNIQUE,
      teacher_id VARCHAR(50) UNIQUE,
      employee_id VARCHAR(50) UNIQUE,
      is_active BOOLEAN DEFAULT TRUE,
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role_id),
      INDEX idx_student_id (student_id),
      INDEX idx_teacher_id (teacher_id)
    )
  `);

  // Courses table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      course_code VARCHAR(50) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      credits INT DEFAULT 3,
      teacher_id INT,
      department VARCHAR(100),
      semester VARCHAR(50),
      academic_year VARCHAR(20),
      max_students INT DEFAULT 30,
      fee_amount DECIMAL(10,2) DEFAULT 0.00,
      start_date DATE,
      end_date DATE,
      status ENUM('active', 'inactive', 'completed') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      INDEX idx_course_code (course_code),
      INDEX idx_teacher (teacher_id),
      INDEX idx_status (status)
    )
  `);

  // Enrollments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      student_id INT NOT NULL,
      course_id INT NOT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('active', 'completed', 'dropped') DEFAULT 'active',
      grade DECIMAL(5,2),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      UNIQUE KEY unique_enrollment (student_id, course_id),
      INDEX idx_student (student_id),
      INDEX idx_course (course_id)
    )
  `);

  // Assignments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      course_id INT NOT NULL,
      teacher_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      max_points DECIMAL(5,2) DEFAULT 100.00,
      due_date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      INDEX idx_course (course_id),
      INDEX idx_teacher (teacher_id)
    )
  `);

  // Submissions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      submission_text TEXT,
      file_path VARCHAR(500),
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('submitted', 'graded', 'late') DEFAULT 'submitted',
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      INDEX idx_assignment (assignment_id),
      INDEX idx_student (student_id)
    )
  `);

  // Grades table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS grades (
      id INT PRIMARY KEY AUTO_INCREMENT,
      assignment_id INT NOT NULL,
      student_id INT NOT NULL,
      teacher_id INT NOT NULL,
      points_earned DECIMAL(5,2),
      feedback TEXT,
      graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      UNIQUE KEY unique_grade (assignment_id, student_id),
      INDEX idx_assignment (assignment_id),
      INDEX idx_student (student_id)
    )
  `);

  // Payments table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      student_id INT,
      fee_structure_id INT,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50),
      transaction_id VARCHAR(255),
      status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
      payment_date DATETIME,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      INDEX idx_student (student_id),
      INDEX idx_status (status),
      INDEX idx_transaction (transaction_id)
    )
  `);

  // Fee structures table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS fee_structures (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      amount DECIMAL(10,2) NOT NULL,
      academic_year VARCHAR(20),
      semester VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      INDEX idx_academic_year (academic_year),
      INDEX idx_active (is_active)
    )
  `);

  // Notifications table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user (user_id),
      INDEX idx_read (is_read)
    )
  `);

  // Audit logs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50),
      resource_id INT,
      description TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      INDEX idx_user (user_id),
      INDEX idx_action (action),
      INDEX idx_created (created_at)
    )
  `);

  console.log('✅ All tables created successfully');
};

// Initialize database with sample data
const initializeDatabase = async () => {
  try {
    await createDatabaseSchema();
    
    // Check if we need to add sample data
    const [users] = await pool.execute('SELECT COUNT(*) as count FROM users');
    
    if (users[0].count === 0) {
      await addSampleData();
    }
    
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    // Don't throw error to prevent app crash, just log it
  }
};

// Add sample data
const addSampleData = async () => {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, employee_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Admin User', 'admin@edulms.com', hashedPassword, 1, 'EMP001', 1]
    );

    console.log('✅ Sample admin user created: admin@edulms.com / admin123');

    // Add more sample data as needed
    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, student_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['John Student', 'student@edulms.com', hashedPassword, 2, 'STU2024001', 1]
    );

    await pool.execute(
      `INSERT INTO users (name, email, password, role_id, teacher_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Jane Instructor', 'instructor@edulms.com', hashedPassword, 3, 'INS2024001', 1]
    );

    console.log('✅ Sample users created');

  } catch (error) {
    console.error('❌ Error adding sample data:', error);
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

// Enhanced query with timeout
const queryWithTimeout = async (sql, params = [], timeoutMs = 30000) => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`SET SESSION max_execution_time = ${timeoutMs}`);
    const [result] = await connection.query(sql, params);
    return result;
  } finally {
    connection.release();
  }
};

// Safe initialization with error handling
const safeInitialize = async () => {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Initialization error (non-fatal):', error.message);
    // Continue running the app even if initialization fails
  }
};

// Run initialization with error handling
setTimeout(() => {
  safeInitialize();
}, 2000);

module.exports = {
  pool,
  checkDatabaseHealth,
  initializeDatabase: safeInitialize,
  gracefulShutdown,
  transaction,
  queryWithTimeout
};