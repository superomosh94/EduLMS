// app/models/Admin.js - FIXED VERSION
const { pool } = require('../../config/database');

class Admin {
  // Get dashboard statistics
  async getDashboardStats() {
    try {
      const [users] = await pool.execute('SELECT COUNT(*) as total FROM users');
      const [students] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE student_id IS NOT NULL AND student_id != ""');
      const [instructors] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE teacher_id IS NOT NULL AND teacher_id != ""');
      const [courses] = await pool.execute('SELECT COUNT(*) as total FROM courses');
      const [payments] = await pool.execute('SELECT COUNT(*) as total FROM payments WHERE status = "completed"');
      const [revenue] = await pool.execute('SELECT SUM(amount) as total FROM payments WHERE status = "completed"');

      return {
        totalUsers: users[0]?.total || 0,
        totalStudents: students[0]?.total || 0,
        totalInstructors: instructors[0]?.total || 0,
        totalCourses: courses[0]?.total || 0,
        totalPayments: payments[0]?.total || 0,
        totalRevenue: revenue[0]?.total || 0
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  // Get user management stats - FIXED VERSION
  async getUserManagementStats() {
    try {
      const [totalUsers] = await pool.execute('SELECT COUNT(*) as count FROM users');
      const [activeUsers] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
      const [newUsers] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');

      return {
        total: totalUsers[0]?.count || 0,
        active: activeUsers[0]?.count || 0,
        new: newUsers[0]?.count || 0
      };
    } catch (error) {
      console.error('Error getting user management stats:', error);
      throw error;
    }
  }

  // Get all users with pagination
  async getUsers(limit = 10, offset = 0) {
    try {
      const [users] = await pool.execute(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      return users;
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
      return users[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  // Get students
  async getStudents() {
    try {
      const [students] = await pool.execute(`
        SELECT * FROM users 
        WHERE student_id IS NOT NULL AND student_id != ''
        ORDER BY created_at DESC
      `);
      return students;
    } catch (error) {
      console.error('Error getting students:', error);
      throw error;
    }
  }

  // Get instructors
  async getInstructors() {
    try {
      const [instructors] = await pool.execute(`
        SELECT * FROM users 
        WHERE teacher_id IS NOT NULL AND teacher_id != ''
        ORDER BY created_at DESC
      `);
      return instructors;
    } catch (error) {
      console.error('Error getting instructors:', error);
      throw error;
    }
  }

  // Count total users
  async countUsers() {
    try {
      const [result] = await pool.execute('SELECT COUNT(*) as total FROM users');
      return result[0]?.total || 0;
    } catch (error) {
      console.error('Error counting users:', error);
      throw error;
    }
  }

  // Create user
  async createUser(userData) {
    try {
      const { name, email, password, role_id, phone, student_id, teacher_id, employee_id } = userData;
      
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password, role_id, phone, student_id, teacher_id, employee_id, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, password, role_id, phone, student_id, teacher_id, employee_id, 1]
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Update user
  async updateUser(userId, userData) {
    try {
      const { name, email, phone, is_active } = userData;
      
      const [result] = await pool.execute(
        'UPDATE users SET name = ?, email = ?, phone = ?, is_active = ? WHERE id = ?',
        [name, email, phone, is_active, userId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Delete user
  async deleteUser(userId) {
    try {
      const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

module.exports = new Admin();