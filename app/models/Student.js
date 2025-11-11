const db = require('../../config/database');
const User = require('./User');

class Student {
  // Get student profile with comprehensive stats
  static async getProfile(studentId) {
    const student = await db.query(`
      SELECT 
        u.*, 
        r.name as role_name,
        COUNT(DISTINCT e.course_id) as enrolled_courses_count,
        COUNT(DISTINCT s.id) as submitted_assignments_count,
        COUNT(DISTINCT g.id) as graded_assignments_count,
        AVG(g.grade_points) as average_grade_points,
        SUM(p.amount) as total_payments,
        COUNT(DISTINCT n.id) as unread_notifications_count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN enrollments e ON u.id = e.student_id AND e.status = 'active'
      LEFT JOIN submissions s ON u.id = s.student_id
      LEFT JOIN grades g ON s.id = g.submission_id
      LEFT JOIN payments p ON u.id = p.student_id AND p.status = 'completed'
      LEFT JOIN notifications n ON u.id = n.user_id AND n.is_read = 0
      WHERE u.id = ? AND u.role_id = (SELECT id FROM roles WHERE name = 'student')
      GROUP BY u.id
    `, [studentId]);

    return student[0] || null;
  }

  // Get student courses with detailed information
  static async getCourses(studentId, page = 1, limit = 10, status = 'active') {
    const offset = (page - 1) * limit;

    const [courses, countResult] = await Promise.all([
      db.query(`
        SELECT 
          c.*,
          u.name as instructor_name,
          u.teacher_id as instructor_code,
          e.enrolled_at,
          e.status as enrollment_status,
          e.final_grade,
          e.grade_points,
          COUNT(DISTINCT a.id) as total_assignments,
          COUNT(DISTINCT s.id) as submitted_assignments,
          COUNT(DISTINCT g.id) as graded_assignments
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN assignments a ON c.id = a.course_id AND a.status = 'published'
        LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE e.student_id = ? AND e.status = ?
        GROUP BY c.id
        ORDER BY e.enrolled_at DESC
        LIMIT ? OFFSET ?
      `, [studentId, status, limit, offset]),
      
      db.query(`
        SELECT COUNT(*) as total 
        FROM enrollments 
        WHERE student_id = ? AND status = ?
      `, [studentId, status])
    ]);

    return {
      courses,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get student assignments with submission status
  static async getAssignments(studentId, filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        a.*,
        c.title as course_title,
        c.course_code,
        s.id as submission_id,
        s.submitted_at,
        s.status as submission_status,
        s.is_late,
        s.file_path,
        s.file_name,
        g.points_earned,
        g.max_points,
        g.grade,
        g.grade_points,
        g.feedback,
        g.graded_at,
        TIMESTAMP(a.due_date) as due_date_timestamp,
        CASE 
          WHEN s.id IS NOT NULL THEN 'submitted'
          WHEN NOW() > a.due_date THEN 'overdue'
          ELSE 'pending'
        END as assignment_status
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN enrollments e ON c.id = e.course_id AND e.student_id = ?
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = ?
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.status = 'active' AND a.status = 'published'
    `;
    
    const params = [studentId, studentId];

    // Apply filters
    if (filters.course_id) {
      query += ` AND a.course_id = ?`;
      params.push(filters.course_id);
    }

    if (filters.status) {
      if (filters.status === 'submitted') {
        query += ` AND s.id IS NOT NULL`;
      } else if (filters.status === 'pending') {
        query += ` AND s.id IS NULL AND a.due_date > NOW()`;
      } else if (filters.status === 'overdue') {
        query += ` AND s.id IS NULL AND a.due_date < NOW()`;
      } else if (filters.status === 'graded') {
        query += ` AND g.id IS NOT NULL`;
      }
    }

    query += ` ORDER BY a.due_date ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [assignments, countResult] = await Promise.all([
      db.query(query, params),
      db.query(`
        SELECT COUNT(*) as total 
        FROM assignments a
        JOIN enrollments e ON a.course_id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active' AND a.status = 'published'
      `, [studentId])
    ]);

    return {
      assignments,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get comprehensive grade information
  static async getGrades(studentId) {
    const grades = await db.query(`
      SELECT 
        c.id as course_id,
        c.course_code,
        c.title as course_title,
        c.credits,
        u.name as instructor_name,
        e.final_grade as course_grade,
        e.grade_points as course_grade_points,
        a.title as assignment_title,
        a.max_points as assignment_max_points,
        g.points_earned,
        g.grade as assignment_grade,
        g.grade_points as assignment_grade_points,
        g.feedback,
        g.graded_at,
        ROUND(AVG(g.grade_points) OVER (PARTITION BY c.id), 2) as course_current_avg
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.teacher_id = u.id
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.student_id = ? AND e.status = 'active'
      ORDER BY c.course_code, g.graded_at DESC
    `, [studentId]);

    return grades;
  }

  // Get payment history with fee details
  static async getPayments(studentId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [payments, countResult] = await Promise.all([
      db.query(`
        SELECT 
          p.*,
          fs.name as fee_name,
          fs.fee_type,
          fs.description as fee_description,
          u.name as verified_by_name,
          CASE 
            WHEN p.status = 'completed' THEN 'success'
            WHEN p.status = 'pending' THEN 'warning'
            WHEN p.status = 'failed' THEN 'danger'
            ELSE 'secondary'
          END as status_class
        FROM payments p
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        LEFT JOIN users u ON p.verified_by = u.id
        WHERE p.student_id = ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `, [studentId, limit, offset]),
      
      db.query(`
        SELECT COUNT(*) as total 
        FROM payments 
        WHERE student_id = ?
      `, [studentId])
    ]);

    // Get payment summary
    const summary = await db.query(`
      SELECT 
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        COUNT(*) as total_transactions
      FROM payments 
      WHERE student_id = ?
    `, [studentId]);

    return {
      payments,
      summary: summary[0] || { total_paid: 0, total_pending: 0, total_transactions: 0 },
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Calculate student GPA and academic summary
  static async getAcademicSummary(studentId) {
    const summary = await db.query(`
      SELECT 
        COUNT(DISTINCT e.course_id) as total_courses,
        SUM(c.credits) as total_credits,
        AVG(e.grade_points) as cumulative_gpa,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT s.id) as submitted_assignments,
        COUNT(DISTINCT g.id) as graded_assignments,
        ROUND((COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT a.id)), 2) as submission_rate
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN assignments a ON c.id = a.course_id AND a.status = 'published'
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.student_id = ? AND e.status = 'active'
    `, [studentId]);

    const recentGrades = await db.query(`
      SELECT 
        g.grade,
        g.grade_points,
        a.title as assignment_title,
        c.course_code,
        g.graded_at
      FROM grades g
      JOIN submissions s ON g.submission_id = s.id
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      WHERE s.student_id = ?
      ORDER BY g.graded_at DESC
      LIMIT 5
    `, [studentId]);

    return {
      summary: summary[0] || {
        total_courses: 0,
        total_credits: 0,
        cumulative_gpa: 0,
        total_assignments: 0,
        submitted_assignments: 0,
        graded_assignments: 0,
        submission_rate: 0
      },
      recentGrades
    };
  }

  // Enroll in course with validation
  static async enrollInCourse(studentId, courseId) {
    // Check if already enrolled
    const existing = await db.query(`
      SELECT id, status FROM enrollments 
      WHERE student_id = ? AND course_id = ?
    `, [studentId, courseId]);

    if (existing.length > 0) {
      if (existing[0].status === 'active') {
        throw new Error('You are already enrolled in this course');
      } else if (existing[0].status === 'dropped') {
        // Reactivate dropped enrollment
        await db.query(
          'UPDATE enrollments SET status = "active" WHERE id = ?',
          [existing[0].id]
        );
        return { reactivated: true };
      }
    }

    // Check course availability
    const course = await db.query(`
      SELECT c.*, COUNT(e.id) as current_enrollments
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      WHERE c.id = ? AND c.status = 'active'
      GROUP BY c.id
    `, [courseId]);

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

    // Enroll student
    await db.query(`
      INSERT INTO enrollments (student_id, course_id, status) 
      VALUES (?, ?, 'active')
    `, [studentId, courseId]);

    // Update course student count
    await db.query(`
      UPDATE courses 
      SET current_students = current_students + 1 
      WHERE id = ?
    `, [courseId]);

    // Create notification
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (?, 'Course Enrollment', ?, 'success', ?, 'course')
    `, [
      studentId,
      `You have successfully enrolled in "${course[0].title}"`,
      courseId
    ]);

    return { success: true };
  }

  // Drop course
  static async dropCourse(studentId, courseId) {
    const result = await db.query(`
      UPDATE enrollments 
      SET status = 'dropped' 
      WHERE student_id = ? AND course_id = ? AND status = 'active'
    `, [studentId, courseId]);

    if (result.affectedRows > 0) {
      // Update course student count
      await db.query(`
        UPDATE courses 
        SET current_students = GREATEST(0, current_students - 1) 
        WHERE id = ?
      `, [courseId]);

      return { success: true };
    }

    throw new Error('Enrollment not found or already dropped');
  }

  // Get available courses for enrollment
  static async getAvailableCourses(studentId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [courses, countResult] = await Promise.all([
      db.query(`
        SELECT 
          c.*,
          u.name as instructor_name,
          u.teacher_id as instructor_code,
          COUNT(DISTINCT e.id) as enrolled_students,
          CASE 
            WHEN c.current_students >= c.max_students THEN 'full'
            WHEN NOW() < c.start_date THEN 'upcoming'
            ELSE 'available'
          END as availability_status,
          EXISTS(
            SELECT 1 FROM enrollments 
            WHERE student_id = ? AND course_id = c.id AND status = 'active'
          ) as is_enrolled
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        WHERE c.status = 'active' 
          AND c.start_date <= CURDATE()
          AND c.end_date >= CURDATE()
        GROUP BY c.id
        HAVING is_enrolled = 0 AND availability_status != 'full'
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `, [studentId, limit, offset]),
      
      db.query(`
        SELECT COUNT(*) as total
        FROM courses c
        WHERE c.status = 'active' 
          AND c.start_date <= CURDATE()
          AND c.end_date >= CURDATE()
          AND c.current_students < c.max_students
          AND NOT EXISTS(
            SELECT 1 FROM enrollments 
            WHERE student_id = ? AND course_id = c.id AND status = 'active'
          )
      `, [studentId])
    ]);

    return {
      courses,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }
}

module.exports = Student;