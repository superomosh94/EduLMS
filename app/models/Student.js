const { pool } = require('../../config/database');

class Student {
  // Find student by user ID
  static async findByUserId(userId) {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, r.name as role_name
         FROM users u 
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? AND r.name = 'student'`,
        [userId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding student by user ID:', error);
      throw error;
    }
  }

  // Get student enrollments
  static async getEnrollments(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT e.*, c.title as course_title, c.course_code, c.credits,
                u.name as instructor_name
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         JOIN users u ON c.teacher_id = u.id
         WHERE e.student_id = ? AND e.status = 'active'
         ORDER BY e.enrolled_at DESC`,
        [studentId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting student enrollments:', error);
      throw error;
    }
  }

  // Get student grades
  static async getGrades(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT g.*, a.title as assignment_title, a.max_points,
                c.title as course_title, c.credits
         FROM grades g
         JOIN assignments a ON g.assignment_id = a.id
         JOIN courses c ON a.course_id = c.id
         WHERE g.student_id = ?
         ORDER BY g.graded_at DESC`,
        [studentId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting student grades:', error);
      throw error;
    }
  }

  // Get student assignments
  static async getAssignments(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT a.*, c.title as course_title,
                s.id as submission_id, s.status as submission_status
         FROM assignments a
         JOIN courses c ON a.course_id = c.id
         JOIN enrollments e ON c.id = e.course_id
         LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = ?
         WHERE e.student_id = ? AND e.status = 'active'
         AND a.status = 'published'
         ORDER BY a.due_date ASC`,
        [studentId, studentId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting student assignments:', error);
      throw error;
    }
  }

  // Get student submissions
  static async getSubmissions(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT s.*, a.title as assignment_title, a.max_points,
                c.title as course_title
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN courses c ON a.course_id = c.id
         WHERE s.student_id = ?
         ORDER BY s.submitted_at DESC`,
        [studentId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting student submissions:', error);
      throw error;
    }
  }

  // Check if student is enrolled in course
  static async isEnrolledInCourse(studentId, courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = "active"',
        [studentId, courseId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking enrollment:', error);
      throw error;
    }
  }

  // Get student fee balance
  static async getFeeBalance(studentId) {
    try {
      const [rows] = await pool.query(
        `SELECT COALESCE(SUM(fs.amount), 0) - COALESCE(SUM(p.amount), 0) as fee_balance 
         FROM fee_structures fs 
         LEFT JOIN payments p ON fs.id = p.fee_structure_id AND p.student_id = ?
         WHERE p.student_id = ? OR p.student_id IS NULL`,
        [studentId, studentId]
      );
      return rows[0]?.fee_balance || 0;
    } catch (error) {
      console.error('Error getting fee balance:', error);
      throw error;
    }
  }
}

module.exports = Student;