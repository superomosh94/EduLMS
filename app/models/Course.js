const db = require('../../config/database');
const { COURSE_STATUS, SEMESTERS } = require('../../config/constants');

class Course {
  // Create new course
  static async create(courseData) {
    const {
      course_code,
      title,
      description,
      credits = 3,
      teacher_id,
      department = null,
      semester = 'fall',
      academic_year,
      max_students = 30,
      fee_amount = 0.00,
      start_date,
      end_date
    } = courseData;

    // Check if course code already exists
    const existingCourse = await db.query(
      'SELECT id FROM courses WHERE course_code = ?',
      [course_code]
    );

    if (existingCourse.length > 0) {
      throw new Error('Course code already exists');
    }

    const result = await db.query(`
      INSERT INTO courses (
        course_code, title, description, credits, teacher_id, department,
        semester, academic_year, max_students, fee_amount, start_date, end_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      course_code, title, description, credits, teacher_id, department,
      semester, academic_year, max_students, fee_amount, start_date, end_date
    ]);

    return result.insertId;
  }

  // Find course by ID with comprehensive details
  static async findById(id) {
    const courses = await db.query(`
      SELECT 
        c.*,
        u.name as instructor_name,
        u.teacher_id as instructor_code,
        u.email as instructor_email,
        u.qualification as instructor_qualification,
        u.specialization as instructor_specialization,
        COUNT(DISTINCT e.id) as enrolled_students_count,
        COUNT(DISTINCT a.id) as assignments_count,
        AVG(g.grade_points) as average_grade
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);

    return courses[0] || null;
  }

  // Find course by code
  static async findByCode(courseCode) {
    const courses = await db.query(`
      SELECT 
        c.*,
        u.name as instructor_name
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      WHERE c.course_code = ?
    `, [courseCode]);

    return courses[0] || null;
  }

  // Get all courses with advanced filtering
  static async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        c.*,
        u.name as instructor_name,
        COUNT(DISTINCT e.id) as enrolled_students_count,
        COUNT(DISTINCT a.id) as assignments_count,
        AVG(g.grade_points) as average_grade
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM courses c`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.status) {
      whereConditions.push('c.status = ?');
      params.push(filters.status);
    }

    if (filters.teacher_id) {
      whereConditions.push('c.teacher_id = ?');
      params.push(filters.teacher_id);
    }

    if (filters.department) {
      whereConditions.push('c.department = ?');
      params.push(filters.department);
    }

    if (filters.semester) {
      whereConditions.push('c.semester = ?');
      params.push(filters.semester);
    }

    if (filters.academic_year) {
      whereConditions.push('c.academic_year = ?');
      params.push(filters.academic_year);
    }

    if (filters.search) {
      whereConditions.push('(c.title LIKE ? OR c.course_code LIKE ? OR c.description LIKE ? OR u.name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    // Availability filter
    if (filters.availability === 'available') {
      whereConditions.push('c.status = "active" AND c.current_students < c.max_students AND c.start_date <= CURDATE() AND c.end_date >= CURDATE()');
    } else if (filters.availability === 'upcoming') {
      whereConditions.push('c.status = "active" AND c.start_date > CURDATE()');
    } else if (filters.availability === 'completed') {
      whereConditions.push('c.status = "completed"');
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [courses, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2)) // Remove limit/offset for count
    ]);

    return {
      courses,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Update course with validation
  static async update(id, updateData) {
    const allowedFields = [
      'title', 'description', 'credits', 'department', 'semester',
      'academic_year', 'max_students', 'fee_amount', 'status',
      'start_date', 'end_date'
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

    // Check if updating course code (must be unique)
    if (updateData.course_code) {
      const existingCourse = await db.query(
        'SELECT id FROM courses WHERE course_code = ? AND id != ?',
        [updateData.course_code, id]
      );

      if (existingCourse.length > 0) {
        throw new Error('Course code already exists');
      }
      fieldsToUpdate.course_code = updateData.course_code;
    }

    const setClause = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(fieldsToUpdate), id];

    await db.query(
      `UPDATE courses SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  // Delete course with validation
  static async delete(id) {
    // Check if course has active enrollments
    const enrollments = await db.query(
      'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ? AND status = "active"',
      [id]
    );

    if (enrollments[0].count > 0) {
      throw new Error('Cannot delete course with active enrollments');
    }

    // Check if course has assignments
    const assignments = await db.query(
      'SELECT COUNT(*) as count FROM assignments WHERE course_id = ?',
      [id]
    );

    if (assignments[0].count > 0) {
      throw new Error('Cannot delete course with assignments. Please delete assignments first.');
    }

    await db.query('DELETE FROM courses WHERE id = ?', [id]);
    return { success: true };
  }

  // Get course statistics
  static async getStatistics() {
    const stats = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(fee_amount) as avg_fee,
        SUM(current_students) as total_students,
        AVG(current_students) as avg_students_per_course
      FROM courses
      GROUP BY status
    `);

    const departmentStats = await db.query(`
      SELECT 
        department,
        COUNT(*) as course_count,
        SUM(current_students) as student_count,
        AVG(fee_amount) as avg_fee
      FROM courses
      WHERE department IS NOT NULL
      GROUP BY department
      ORDER BY course_count DESC
    `);

    const semesterStats = await db.query(`
      SELECT 
        semester,
        academic_year,
        COUNT(*) as course_count,
        SUM(current_students) as student_count
      FROM courses
      GROUP BY semester, academic_year
      ORDER BY academic_year DESC, semester
    `);

    return {
      byStatus: stats,
      byDepartment: departmentStats,
      bySemester: semesterStats
    };
  }

  // Get course assignments
  static async getAssignments(courseId, status = null) {
    let query = `
      SELECT 
        a.*,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT g.id) as graded_count,
        AVG(g.points_earned) as average_score
      FROM assignments a
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.course_id = ?
    `;

    const params = [courseId];

    if (status) {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY a.id ORDER BY a.due_date ASC`;

    const assignments = await db.query(query, params);
    return assignments;
  }

  // Update course status
  static async updateStatus(courseId, status) {
    const validStatuses = ['active', 'inactive', 'pending', 'completed'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status');
    }

    await db.query(
      'UPDATE courses SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, courseId]
    );

    return this.findById(courseId);
  }

  // Get courses by department
  static async getByDepartment(department, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [courses, countResult] = await Promise.all([
      db.query(`
        SELECT 
          c.*,
          u.name as instructor_name,
          COUNT(DISTINCT e.id) as enrolled_students
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        WHERE c.department = ? AND c.status = 'active'
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [department, limit, offset]),
      
      db.query(`
        SELECT COUNT(*) as total 
        FROM courses 
        WHERE department = ? AND status = 'active'
      `, [department])
    ]);

    return {
      courses,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get popular courses (most enrolled)
  static async getPopularCourses(limit = 10) {
    const courses = await db.query(`
      SELECT 
        c.*,
        u.name as instructor_name,
        COUNT(DISTINCT e.id) as enrolled_students_count
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY enrolled_students_count DESC
      LIMIT ?
    `, [limit]);

    return courses;
  }
}

module.exports = Course;