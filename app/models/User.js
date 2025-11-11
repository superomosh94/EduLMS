const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/constants');

class User {
  // Create new user
  static async create(userData) {
    const {
      name,
      email,
      password,
      role_id,
      phone = null,
      address = null,
      date_of_birth = null,
      gender = null,
      profile_image = null,
      student_id = null,
      teacher_id = null,
      employee_id = null,
      admission_date = null,
      parent_phone = null,
      qualification = null,
      specialization = null,
      hire_date = null
    } = userData;

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      `INSERT INTO users (
        name, email, password, role_id, phone, address, date_of_birth, gender, profile_image,
        student_id, teacher_id, employee_id, admission_date, parent_phone, qualification, 
        specialization, hire_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, email, hashedPassword, role_id, phone, address, date_of_birth, gender, profile_image,
        student_id, teacher_id, employee_id, admission_date, parent_phone, qualification,
        specialization, hire_date
      ]
    );

    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const users = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email]
    );
    return users[0] || null;
  }

  // Find user by ID
  static async findById(id) {
    const users = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [id]
    );
    return users[0] || null;
  }

  // Find user by student ID
  static async findByStudentId(studentId) {
    const users = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.student_id = ?`,
      [studentId]
    );
    return users[0] || null;
  }

  // Find user by teacher ID
  static async findByTeacherId(teacherId) {
    const users = await db.query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.teacher_id = ?`,
      [teacherId]
    );
    return users[0] || null;
  }

  // Get all users with pagination and filters
  static async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT u.*, r.name as role_name 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
    `;
    let countQuery = `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.role) {
      whereConditions.push('r.name = ?');
      params.push(filters.role);
    }

    if (filters.search) {
      whereConditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.student_id LIKE ? OR u.teacher_id LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.is_active !== undefined) {
      whereConditions.push('u.is_active = ?');
      params.push(filters.is_active);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [users, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)) // Remove limit/offset for count
    ]);

    return {
      users,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Update user
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'phone', 'address', 'date_of_birth', 'gender', 'profile_image',
      'qualification', 'specialization', 'parent_phone', 'is_active'
    ];

    const fieldsToUpdate = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        fieldsToUpdate[field] = updateData[field];
      }
    });

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(fieldsToUpdate), id];

    await db.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  // Change password
  static async changePassword(id, newPassword) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    await db.query(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );
  }

  // Delete user (soft delete)
  static async delete(id) {
    await db.query(
      'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );
  }

  // Get user statistics
  static async getStatistics() {
    const stats = await db.query(`
      SELECT 
        r.name as role,
        COUNT(*) as count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
      GROUP BY r.name
    `);

    const total = await db.query('SELECT COUNT(*) as total FROM users WHERE is_active = 1');
    const recentRegistrations = await db.query(`
      SELECT COUNT(*) as recent_count 
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    return {
      byRole: stats,
      total: total[0].total,
      recentRegistrations: recentRegistrations[0].recent_count
    };
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Get role ID by name
  static async getRoleId(roleName) {
    const roles = await db.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    return roles[0] ? roles[0].id : null;
  }

  // Generate unique IDs
  static async generateUniqueId(role) {
    const prefix = {
      'student': 'STU',
      'instructor': 'TEA', 
      'finance_officer': 'FIN'
    }[role];

    if (!prefix) return null;

    const count = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE role_id = (SELECT id FROM roles WHERE name = ?)',
      [role]
    );

    return `${prefix}${String(count[0].count + 1).padStart(4, '0')}`;
  }
}

module.exports = User;