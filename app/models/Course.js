const { pool } = require('../../config/database');

class Course {
  // Find course by ID
  static async findById(courseId) {
    try {
      const [rows] = await pool.query(
        `SELECT c.*, u.name as instructor_name
         FROM courses c
         JOIN users u ON c.teacher_id = u.id
         WHERE c.id = ?`,
        [courseId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding course by ID:', error);
      throw error;
    }
  }

  // Get course materials
  static async getMaterials(courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM course_materials WHERE course_id = ? ORDER BY created_at DESC',
        [courseId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting course materials:', error);
      throw error;
    }
  }

  // Get course assignments
  static async getAssignments(courseId) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM assignments WHERE course_id = ? AND status = "published" ORDER BY due_date',
        [courseId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting course assignments:', error);
      throw error;
    }
  }

  // Check if student is enrolled in course
  static async isStudentEnrolled(courseId, studentId) {
    try {
      const [rows] = await pool.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = "active"',
        [courseId, studentId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error checking student enrollment:', error);
      throw error;
    }
  }

  // Get course students
  static async getStudents(courseId) {
    try {
      const [rows] = await pool.query(
        `SELECT u.*, e.enrolled_at, e.status as enrollment_status
         FROM enrollments e
         JOIN users u ON e.student_id = u.id
         WHERE e.course_id = ? AND e.status = 'active'
         ORDER BY u.name`,
        [courseId]
      );
      return rows;
    } catch (error) {
      console.error('Error getting course students:', error);
      throw error;
    }
  }
}

module.exports = Course;