const db = require('../../config/database');

class Enrollment {
  // Create enrollment with validation
  static async create(enrollmentData) {
    const { student_id, course_id, status = 'active' } = enrollmentData;

    // Check if already enrolled
    const existing = await db.query(`
      SELECT id, status FROM enrollments 
      WHERE student_id = ? AND course_id = ?
    `, [student_id, course_id]);

    if (existing.length > 0) {
      if (existing[0].status === 'active') {
        throw new Error('Student is already enrolled in this course');
      } else {
        // Reactivate existing enrollment
        await db.query(
          'UPDATE enrollments SET status = "active" WHERE id = ?',
          [existing[0].id]
        );
        return { reactivated: true, enrollmentId: existing[0].id };
      }
    }

    // Check course capacity and availability
    const course = await db.query(`
      SELECT c.*, COUNT(e.id) as current_enrollments
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      WHERE c.id = ? AND c.status = 'active'
      GROUP BY c.id
    `, [course_id]);

    if (course.length === 0) {
      throw new Error('Course not found or not available for enrollment');
    }

    if (course[0].current_enrollments >= course[0].max_students) {
      throw new Error('Course has reached maximum capacity');
    }

    // Check if course has started
    if (new Date(course[0].start_date) > new Date()) {
      throw new Error('Course has not started yet');
    }

    // Create enrollment
    const result = await db.query(`
      INSERT INTO enrollments (student_id, course_id, status) 
      VALUES (?, ?, ?)
    `, [student_id, course_id, status]);

    // Update course student count
    await db.query(`
      UPDATE courses 
      SET current_students = current_students + 1 
      WHERE id = ?
    `, [course_id]);

    return { success: true, enrollmentId: result.insertId };
  }

  // Update enrollment status
  static async updateStatus(enrollmentId, status) {
    const validStatuses = ['active', 'inactive', 'completed', 'dropped'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid enrollment status');
    }

    const enrollment = await db.query(`
      SELECT * FROM enrollments WHERE id = ?
    `, [enrollmentId]);

    if (enrollment.length === 0) {
      throw new Error('Enrollment not found');
    }

    const result = await db.query(`
      UPDATE enrollments 
      SET status = ?, 
          ${status === 'completed' ? 'completion_date = CURDATE(),' : ''}
          updated_at = NOW() 
      WHERE id = ?
    `, [status, enrollmentId]);

    // Update course student count if status changed from/to active
    if (enrollment[0].status === 'active' && status !== 'active') {
      await db.query(`
        UPDATE courses 
        SET current_students = GREATEST(0, current_students - 1) 
        WHERE id = ?
      `, [enrollment[0].course_id]);
    } else if (enrollment[0].status !== 'active' && status === 'active') {
      await db.query(`
        UPDATE courses 
        SET current_students = current_students + 1 
        WHERE id = ?
      `, [enrollment[0].course_id]);
    }

    return { success: true, affectedRows: result.affectedRows };
  }

  // Get enrollment by ID with details
  static async findById(enrollmentId) {
    const enrollments = await db.query(`
      SELECT 
        e.*,
        u.name as student_name,
        u.student_id as student_code,
        u.email as student_email,
        c.title as course_title,
        c.course_code,
        c.credits,
        inst.name as instructor_name
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      JOIN courses c ON e.course_id = c.id
      JOIN users inst ON c.teacher_id = inst.id
      WHERE e.id = ?
    `, [enrollmentId]);

    return enrollments[0] || null;
  }

  // Get enrollments with filtering and pagination
  static async findAll(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        e.*,
        u.name as student_name,
        u.student_id as student_code,
        u.email as student_email,
        c.title as course_title,
        c.course_code,
        c.department,
        inst.name as instructor_name,
        COUNT(DISTINCT a.id) as assignments_count,
        COUNT(DISTINCT s.id) as submissions_count,
        AVG(g.grade_points) as average_grade
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      JOIN courses c ON e.course_id = c.id
      JOIN users inst ON c.teacher_id = inst.id
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = u.id
      LEFT JOIN grades g ON s.id = g.submission_id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM enrollments e`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.student_id) {
      whereConditions.push('e.student_id = ?');
      params.push(filters.student_id);
    }

    if (filters.course_id) {
      whereConditions.push('e.course_id = ?');
      params.push(filters.course_id);
    }

    if (filters.status) {
      whereConditions.push('e.status = ?');
      params.push(filters.status);
    }

    if (filters.department) {
      whereConditions.push('c.department = ?');
      params.push(filters.department);
    }

    if (filters.instructor_id) {
      whereConditions.push('c.teacher_id = ?');
      params.push(filters.instructor_id);
    }

    if (filters.search) {
      whereConditions.push('(u.name LIKE ? OR u.student_id LIKE ? OR c.title LIKE ? OR c.course_code LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` GROUP BY e.id ORDER BY e.enrolled_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [enrollments, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      enrollments,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get enrollment statistics
  static async getStatistics() {
    const stats = await Promise.all([
      // Status distribution
      db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM enrollments)) as percentage
        FROM enrollments
        GROUP BY status
        ORDER BY count DESC
      `),
      
      // Department distribution
      db.query(`
        SELECT 
          c.department,
          COUNT(*) as enrollment_count,
          COUNT(DISTINCT e.student_id) as unique_students
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        WHERE e.status = 'active'
        GROUP BY c.department
        ORDER BY enrollment_count DESC
      `),
      
      // Monthly enrollment trends
      db.query(`
        SELECT 
          DATE_FORMAT(enrolled_at, '%Y-%m') as month,
          COUNT(*) as new_enrollments
        FROM enrollments
        WHERE enrolled_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(enrolled_at, '%Y-%m')
        ORDER BY month DESC
      `),
      
      // Course popularity
      db.query(`
        SELECT 
          c.course_code,
          c.title,
          c.department,
          COUNT(e.id) as enrollment_count
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        GROUP BY c.id
        ORDER BY enrollment_count DESC
        LIMIT 10
      `)
    ]);

    return {
      byStatus: stats[0],
      byDepartment: stats[1],
      monthlyTrends: stats[2],
      popularCourses: stats[3]
    };
  }

  // Bulk enrollment operations
  static async bulkEnrollmentOperation(operation, enrollmentIds, data = {}) {
    let result;
    
    switch (operation) {
      case 'activate':
        result = await db.query(
          'UPDATE enrollments SET status = "active" WHERE id IN (?)',
          [enrollmentIds]
        );
        break;
        
      case 'complete':
        result = await db.query(
          'UPDATE enrollments SET status = "completed", completion_date = CURDATE() WHERE id IN (?)',
          [enrollmentIds]
        );
        break;
        
      case 'drop':
        result = await db.query(
          'UPDATE enrollments SET status = "dropped" WHERE id IN (?)',
          [enrollmentIds]
        );
        break;
        
      default:
        throw new Error('Invalid operation');
    }

    // Update course student counts for affected courses
    const affectedCourses = await db.query(`
      SELECT DISTINCT course_id FROM enrollments WHERE id IN (?)
    `, [enrollmentIds]);

    for (const course of affectedCourses) {
      const activeCount = await db.query(`
        SELECT COUNT(*) as count FROM enrollments 
        WHERE course_id = ? AND status = 'active'
      `, [course.course_id]);

      await db.query(`
        UPDATE courses SET current_students = ? WHERE id = ?
      `, [activeCount[0].count, course.course_id]);
    }

    return { affectedRows: result.affectedRows };
  }

  // Check if student can enroll in course
  static async canEnroll(studentId, courseId) {
    const checks = await Promise.all([
      // Check if already enrolled
      db.query(`
        SELECT status FROM enrollments 
        WHERE student_id = ? AND course_id = ?
      `, [studentId, courseId]),
      
      // Check course capacity and status
      db.query(`
        SELECT 
          c.*,
          COUNT(e.id) as current_enrollments
        FROM courses c
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        WHERE c.id = ?
        GROUP BY c.id
      `, [courseId]),
      
      // Check student's current course load
      db.query(`
        SELECT COUNT(*) as current_courses
        FROM enrollments
        WHERE student_id = ? AND status = 'active'
      `, [studentId])
    ]);

    const [existingEnrollment, course, currentLoad] = checks;

    if (existingEnrollment.length > 0) {
      if (existingEnrollment[0].status === 'active') {
        return { canEnroll: false, reason: 'Already enrolled in this course' };
      }
    }

    if (course.length === 0) {
      return { canEnroll: false, reason: 'Course not found' };
    }

    if (course[0].status !== 'active') {
      return { canEnroll: false, reason: 'Course is not active' };
    }

    if (course[0].current_enrollments >= course[0].max_students) {
      return { canEnroll: false, reason: 'Course is full' };
    }

    if (new Date(course[0].start_date) > new Date()) {
      return { canEnroll: false, reason: 'Course has not started yet' };
    }

    // Optional: Check if student has reached maximum course limit
    const MAX_COURSES = 6; // Configurable
    if (currentLoad[0].current_courses >= MAX_COURSES) {
      return { canEnroll: false, reason: `Maximum course limit (${MAX_COURSES}) reached` };
    }

    return { canEnroll: true };
  }

  // Get student's course progress
  static async getStudentProgress(studentId, courseId) {
    const progress = await db.query(`
      SELECT 
        e.*,
        c.title as course_title,
        c.course_code,
        c.credits,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT s.id) as submitted_assignments,
        COUNT(DISTINCT g.id) as graded_assignments,
        AVG(g.grade_points) as current_average,
        COUNT(DISTINCT CASE WHEN s.is_late = 1 THEN s.id END) as late_submissions,
        (COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT a.id)) as submission_rate
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN assignments a ON c.id = a.course_id AND a.status = 'published'
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.student_id = ? AND e.course_id = ?
      GROUP BY e.id
    `, [studentId, courseId]);

    return progress[0] || null;
  }

  // Update final grade for enrollment
  static async updateFinalGrade(enrollmentId, finalGrade, gradePoints) {
    const result = await db.query(`
      UPDATE enrollments 
      SET final_grade = ?, grade_points = ?, completion_date = CURDATE(), status = 'completed'
      WHERE id = ?
    `, [finalGrade, gradePoints, enrollmentId]);

    return { success: true, affectedRows: result.affectedRows };
  }
}

module.exports = Enrollment;