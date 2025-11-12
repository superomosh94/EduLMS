const { pool } = require('../../config/database');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/constants');
const IDGeneratorService = require('../services/idGeneratorService');

class User {
  // Create new user with auto-generated IDs
  static async create(userData) {
    let connection;
    try {
      console.log('📝 Creating user with data:', userData);
      
      // Validate required fields
      if (!userData.name || !userData.email || !userData.password || !userData.role_id) {
        throw new Error('Missing required fields: name, email, password, or role_id');
      }
      
      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Generate role-based ID
      const roleBasedId = await IDGeneratorService.generateRoleBasedID(userData.role_id);
      
      // Prepare user data with auto-generated IDs
      const userInsertData = {
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        role_id: userData.role_id,
        phone: userData.phone || null,
        address: userData.address || null,
        date_of_birth: userData.date_of_birth || null,
        gender: userData.gender || null,
        profile_image: userData.profile_image || null,
        email_verified: userData.email_verified !== undefined ? userData.email_verified : 0,
        is_active: userData.is_active !== undefined ? userData.is_active : 1
      };

      // Set role-specific ID fields
      switch (parseInt(userData.role_id)) {
        case 1: // Admin
          userInsertData.employee_id = roleBasedId;
          break;
        case 2: // Instructor
          userInsertData.teacher_id = roleBasedId;
          userInsertData.qualification = userData.qualification || null;
          userInsertData.specialization = userData.specialization || null;
          userInsertData.hire_date = userData.hire_date || new Date();
          break;
        case 3: // Student
          userInsertData.student_id = roleBasedId;
          userInsertData.admission_date = userData.admission_date || new Date();
          userInsertData.parent_phone = userData.parent_phone || null;
          break;
        case 4: // Finance Officer
          userInsertData.employee_id = roleBasedId;
          break;
      }

      console.log('📝 Inserting user with auto-generated ID:', roleBasedId);

      // Build dynamic INSERT query based on provided fields
      const fields = [];
      const placeholders = [];
      const values = [];
      
      Object.keys(userInsertData).forEach(key => {
        if (userInsertData[key] !== undefined && userInsertData[key] !== null) {
          fields.push(key);
          placeholders.push('?');
          values.push(userInsertData[key]);
        }
      });

      const sql = `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
      
      console.log('📝 Executing SQL:', sql);
      console.log('📝 With values:', values.map(v => typeof v === 'string' ? v.substring(0, 10) + '...' : v));
      
      // FIXED: Use pool.query() instead of db.execute()
      const [result] = await pool.query(sql, values);
      
      console.log('✅ User created successfully with ID:', result.insertId);
      return result.insertId;
      
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      // FIXED: Use pool.query() instead of db.execute()
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.email = ? AND u.is_active = 1`,
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  // Find user by ID
  static async findById(id) {
    try {
      // FIXED: Use pool.query()
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  // Find user by student ID
  static async findByStudentId(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.student_id = ? AND u.is_active = 1`,
        [studentId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by student ID:', error);
      return null;
    }
  }

  // Find user by teacher ID
  static async findByTeacherId(teacherId) {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.teacher_id = ? AND u.is_active = 1`,
        [teacherId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by teacher ID:', error);
      return null;
    }
  }

  // Find user by employee ID
  static async findByEmployeeId(employeeId) {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.employee_id = ? AND u.is_active = 1`,
        [employeeId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by employee ID:', error);
      return null;
    }
  }

  // Get all users with pagination and filters
  static async findAll(filters = {}, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      let query = `
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
      `;
      let countQuery = `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id`;
      const params = [];
      const whereConditions = ['u.is_active = 1'];

      // Apply filters
      if (filters.role) {
        whereConditions.push('r.name = ?');
        params.push(filters.role);
      }

      if (filters.search) {
        whereConditions.push('(u.name LIKE ? OR u.email LIKE ? OR u.student_id LIKE ? OR u.teacher_id LIKE ? OR u.employee_id LIKE ?)');
        params.push(
          `%${filters.search}%`, 
          `%${filters.search}%`, 
          `%${filters.search}%`, 
          `%${filters.search}%`,
          `%${filters.search}%`
        );
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

      // FIXED: Use pool.query() for both queries
      const [users] = await pool.query(query, params);
      
      // For count query, remove limit/offset parameters
      const countParams = params.slice(0, -2);
      const [countResult] = await pool.query(countQuery, countParams);

      return {
        users,
        total: countResult[0].total,
        page: parseInt(page),
        totalPages: Math.ceil(countResult[0].total / limit)
      };
    } catch (error) {
      console.error('Error finding all users:', error);
      throw error;
    }
  }

  // Update user
  static async update(id, updateData) {
    try {
      const allowedFields = [
        'name', 'phone', 'address', 'date_of_birth', 'gender', 'profile_image',
        'qualification', 'specialization', 'parent_phone', 'is_active', 'email_verified'
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

      // FIXED: Use pool.query()
      await pool.query(
        `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
        values
      );

      return await this.findById(id);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Change password
  static async changePassword(id, newPassword) {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // FIXED: Use pool.query()
      await pool.query(
        'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
        [hashedPassword, id]
      );
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // Delete user (soft delete)
  static async delete(id) {
    try {
      // FIXED: Use pool.query()
      await pool.query(
        'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?',
        [id]
      );
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // Get user statistics
  static async getStatistics() {
    try {
      // FIXED: Use pool.query()
      const [stats] = await pool.query(`
        SELECT 
          r.name as role,
          COUNT(*) as count
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1
        GROUP BY r.name
      `);

      const [totalResult] = await pool.query('SELECT COUNT(*) as total FROM users WHERE is_active = 1');
      const [recentResult] = await pool.query(`
        SELECT COUNT(*) as recent_count 
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND is_active = 1
      `);
      
      return {
        byRole: stats,
        total: totalResult[0].total,
        recentRegistrations: recentResult[0].recent_count
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw error;
    }
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  // Get role ID by name
  static async getRoleId(roleName) {
    try {
      const [rows] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
      return rows[0] ? rows[0].id : null;
    } catch (error) {
      console.error('Error getting role ID:', error);
      return null;
    }
  }

  // Update last login
  static async updateLastLogin(id) {
    try {
      await pool.query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [id]
      );
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Verify email
  static async verifyEmail(id) {
    try {
      await pool.query(
        'UPDATE users SET email_verified = 1 WHERE id = ?',
        [id]
      );
      return true;
    } catch (error) {
      console.error('Error verifying email:', error);
      return false;
    }
  }

  // Find user by phone number
  static async findByPhone(phone) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE phone = ? AND is_active = 1',
        [phone]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by phone:', error);
      return null;
    }
  }

  // Simple user creation for registration (without complex ID generation)
  static async createSimple(userData) {
    try {
      const { first_name, last_name, email, phone, password, role = 'student' } = userData;
      
      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Get role ID
      const roleId = await this.getRoleId(role);

      const sql = `
        INSERT INTO users (first_name, last_name, email, phone, password, role_id, is_active, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, 1, NOW())
      `;
      
      const [result] = await pool.query(sql, [first_name, last_name, email, phone, hashedPassword, roleId]);
      return result.insertId;
    } catch (error) {
      console.error('Error in createSimple:', error);
      throw error;
    }
  }
}

module.exports = User;