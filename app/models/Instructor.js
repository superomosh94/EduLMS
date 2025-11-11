const db = require('../../config/database');
const User = require('./User');

class Instructor {
  // Get instructor profile with comprehensive stats
  static async getProfile(instructorId) {
    const profile = await db.query(`
      SELECT 
        u.*,
        r.name as role_name,
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT e.id) as total_students,
        AVG(c.fee_amount) as avg_course_fee,
        SUM(c.fee_amount) as total_course_revenue,
        COUNT(DISTINCT n.id) as unread_notifications_count
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN courses c ON u.id = c.teacher_id
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN notifications n ON u.id = n.user_id AND n.is_read = 0
      WHERE u.id = ? AND u.role_id = (SELECT id FROM roles WHERE name = 'instructor')
      GROUP BY u.id
    `, [instructorId]);

    return profile[0] || null;
  }

  // Get instructor courses with detailed analytics
  static async getCourses(instructorId, filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        c.*,
        COUNT(DISTINCT e.id) as enrolled_students_count,
        COUNT(DISTINCT a.id) as assignments_count,
        AVG(g.grade_points) as average_grade,
        COUNT(DISTINCT s.id) as total_submissions,
        ROUND((COUNT(DISTINCT s.id) * 100.0 / (COUNT(DISTINCT a.id) * COUNT(DISTINCT e.id))), 2) as submission_rate
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN assignments a ON c.id = a.course_id
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE c.teacher_id = ?
    `;
    
    const params = [instructorId];

    // Apply filters
    if (filters.status) {
      query += ` AND c.status = ?`;
      params.push(filters.status);
    }

    if (filters.semester) {
      query += ` AND c.semester = ?`;
      params.push(filters.semester);
    }

    if (filters.academic_year) {
      query += ` AND c.academic_year = ?`;
      params.push(filters.academic_year);
    }

    query += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [courses, countResult] = await Promise.all([
      db.query(query, params),
      db.query(`
        SELECT COUNT(*) as total 
        FROM courses 
        WHERE teacher_id = ? ${filters.status ? 'AND status = ?' : ''}
      `, filters.status ? [instructorId, filters.status] : [instructorId])
    ]);

    return {
      courses,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get course students with performance metrics
  static async getCourseStudents(courseId, instructorId) {
    // Verify instructor owns the course
    const course = await db.query(`
      SELECT id, title FROM courses WHERE id = ? AND teacher_id = ?
    `, [courseId, instructorId]);

    if (course.length === 0) {
      throw new Error('Course not found or access denied');
    }

    const students = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.student_id,
        u.phone,
        e.enrolled_at,
        e.status as enrollment_status,
        e.final_grade,
        e.grade_points,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT s.id) as submissions_count,
        COUNT(DISTINCT g.id) as graded_count,
        AVG(g.grade_points) as average_grade,
        MAX(g.graded_at) as last_graded_date
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN assignments a ON e.course_id = a.course_id AND a.status = 'published'
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = u.id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.course_id = ? AND e.status = 'active'
      GROUP BY u.id
      ORDER BY u.name
    `, [courseId]);

    return {
      course: course[0],
      students
    };
  }

  // Get assignments needing grading
  static async getAssignmentsForGrading(instructorId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const [assignments, countResult] = await Promise.all([
      db.query(`
        SELECT 
          a.*,
          c.title as course_title,
          c.course_code,
          COUNT(DISTINCT s.id) as total_submissions,
          COUNT(DISTINCT g.id) as graded_submissions,
          (COUNT(DISTINCT s.id) - COUNT(DISTINCT g.id)) as pending_grading,
          ROUND((COUNT(DISTINCT g.id) * 100.0 / COUNT(DISTINCT s.id)), 2) as grading_progress
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN submissions s ON a.id = s.assignment_id
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE c.teacher_id = ? AND a.status = 'published'
        GROUP BY a.id
        HAVING pending_grading > 0
        ORDER BY a.due_date ASC
        LIMIT ? OFFSET ?
      `, [instructorId, limit, offset]),
      
      db.query(`
        SELECT COUNT(DISTINCT a.id) as total
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        LEFT JOIN submissions s ON a.id = s.assignment_id
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE c.teacher_id = ? AND a.status = 'published'
        GROUP BY a.id
        HAVING (COUNT(DISTINCT s.id) - COUNT(DISTINCT g.id)) > 0
      `, [instructorId])
    ]);

    return {
      assignments,
      total: countResult.length,
      page: parseInt(page),
      totalPages: Math.ceil(countResult.length / limit)
    };
  }

  // Get assignment submissions with detailed information
  static async getAssignmentSubmissions(assignmentId, instructorId, filters = {}) {
    // Verify instructor owns the assignment
    const assignment = await db.query(`
      SELECT a.*, c.title as course_title, c.course_code 
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE a.id = ? AND c.teacher_id = ?
    `, [assignmentId, instructorId]);

    if (assignment.length === 0) {
      throw new Error('Assignment not found or access denied');
    }

    let query = `
      SELECT 
        s.*,
        u.name as student_name,
        u.student_id,
        u.email,
        g.points_earned,
        g.grade,
        g.feedback,
        g.graded_at,
        g.id as grade_id,
        CASE 
          WHEN g.id IS NOT NULL THEN 'graded'
          WHEN s.id IS NOT NULL THEN 'submitted'
          ELSE 'missing'
        END as submission_status,
        CASE 
          WHEN s.is_late = 1 THEN 'late'
          ELSE 'on-time'
        END as timeliness
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN submissions s ON u.id = s.student_id AND s.assignment_id = ?
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.course_id = ? AND e.status = 'active'
    `;

    const params = [assignmentId, assignment[0].course_id];

    // Apply filters
    if (filters.status === 'graded') {
      query += ` AND g.id IS NOT NULL`;
    } else if (filters.status === 'submitted') {
      query += ` AND s.id IS NOT NULL AND g.id IS NULL`;
    } else if (filters.status === 'missing') {
      query += ` AND s.id IS NULL`;
    }

    if (filters.timeliness === 'late') {
      query += ` AND s.is_late = 1`;
    } else if (filters.timeliness === 'on-time') {
      query += ` AND (s.is_late = 0 OR s.is_late IS NULL)`;
    }

    query += ` ORDER BY u.name`;

    const submissions = await db.query(query, params);

    // Get submission statistics
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_students,
        COUNT(DISTINCT s.id) as submitted_count,
        COUNT(DISTINCT g.id) as graded_count,
        COUNT(DISTINCT CASE WHEN s.is_late = 1 THEN s.id END) as late_count,
        AVG(g.points_earned) as average_score
      FROM enrollments e
      LEFT JOIN submissions s ON e.student_id = s.student_id AND s.assignment_id = ?
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.course_id = ? AND e.status = 'active'
    `, [assignmentId, assignment[0].course_id]);

    return {
      assignment: assignment[0],
      submissions,
      statistics: stats[0] || {
        total_students: 0,
        submitted_count: 0,
        graded_count: 0,
        late_count: 0,
        average_score: 0
      }
    };
  }

  // Grade submission with comprehensive validation
  static async gradeSubmission(submissionId, instructorId, gradeData) {
    const { points_earned, grade, feedback } = gradeData;

    // Verify instructor can grade this submission
    const submission = await db.query(`
      SELECT s.*, a.max_points, a.title as assignment_title, c.teacher_id, u.name as student_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON s.student_id = u.id
      WHERE s.id = ?
    `, [submissionId]);

    if (submission.length === 0) {
      throw new Error('Submission not found');
    }

    if (submission[0].teacher_id !== instructorId) {
      throw new Error('Access denied - not your student');
    }

    if (points_earned > submission[0].max_points) {
      throw new Error(`Points earned cannot exceed maximum points (${submission[0].max_points})`);
    }

    if (points_earned < 0) {
      throw new Error('Points earned cannot be negative');
    }

    // Calculate grade points based on percentage
    const percentage = (points_earned / submission[0].max_points) * 100;
    let gradePoints = 0;

    // Grade points calculation
    if (percentage >= 90) gradePoints = 4.0;
    else if (percentage >= 85) gradePoints = 3.7;
    else if (percentage >= 80) gradePoints = 3.3;
    else if (percentage >= 75) gradePoints = 3.0;
    else if (percentage >= 70) gradePoints = 2.7;
    else if (percentage >= 65) gradePoints = 2.3;
    else if (percentage >= 60) gradePoints = 2.0;
    else if (percentage >= 55) gradePoints = 1.7;
    else if (percentage >= 50) gradePoints = 1.3;
    else if (percentage >= 45) gradePoints = 1.0;
    else gradePoints = 0.0;

    // Check if grade already exists
    const existingGrade = await db.query(`
      SELECT id FROM grades WHERE submission_id = ?
    `, [submissionId]);

    let result;
    if (existingGrade.length > 0) {
      // Update existing grade
      result = await db.query(`
        UPDATE grades 
        SET points_earned = ?, grade = ?, feedback = ?, grade_points = ?, updated_at = NOW()
        WHERE submission_id = ?
      `, [points_earned, grade, feedback, gradePoints, submissionId]);
    } else {
      // Insert new grade
      result = await db.query(`
        INSERT INTO grades (submission_id, assignment_id, student_id, teacher_id, points_earned, max_points, grade, feedback, grade_points)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        submissionId,
        submission[0].assignment_id,
        submission[0].student_id,
        instructorId,
        points_earned,
        submission[0].max_points,
        grade,
        feedback,
        gradePoints
      ]);
    }

    // Update submission status
    await db.query(`
      UPDATE submissions SET status = 'graded' WHERE id = ?
    `, [submissionId]);

    // Create notification for student
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (?, 'Assignment Graded', ?, 'info', ?, 'grade')
    `, [
      submission[0].student_id,
      `Your submission for "${submission[0].assignment_title}" has been graded. You scored ${points_earned}/${submission[0].max_points} (${grade})`,
      submissionId
    ]);

    return {
      success: true,
      gradeId: existingGrade.length > 0 ? existingGrade[0].id : result.insertId,
      points_earned,
      grade,
      gradePoints,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  // Generate comprehensive course report
  static async generateCourseReport(courseId, instructorId) {
    // Verify instructor owns the course
    const course = await db.query(`
      SELECT * FROM courses WHERE id = ? AND teacher_id = ?
    `, [courseId, instructorId]);

    if (course.length === 0) {
      throw new Error('Course not found or access denied');
    }

    const studentPerformance = await db.query(`
      SELECT 
        u.student_id,
        u.name as student_name,
        u.email,
        COUNT(DISTINCT a.id) as total_assignments,
        COUNT(DISTINCT s.id) as submitted_assignments,
        COUNT(DISTINCT g.id) as graded_assignments,
        AVG(g.points_earned) as average_score,
        AVG(g.grade_points) as average_grade_points,
        MAX(g.graded_at) as last_graded,
        SUM(CASE WHEN s.is_late = 1 THEN 1 ELSE 0 END) as late_submissions
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      LEFT JOIN assignments a ON e.course_id = a.course_id AND a.status = 'published'
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = u.id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE e.course_id = ? AND e.status = 'active'
      GROUP BY u.id
      ORDER BY average_grade_points DESC
    `, [courseId]);

    const assignmentStats = await db.query(`
      SELECT 
        a.*,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT g.id) as graded_count,
        AVG(g.points_earned) as average_score,
        MAX(g.points_earned) as highest_score,
        MIN(g.points_earned) as lowest_score,
        COUNT(DISTINCT CASE WHEN s.is_late = 1 THEN s.id END) as late_submissions
      FROM assignments a
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.course_id = ?
      GROUP BY a.id
      ORDER BY a.due_date
    `, [courseId]);

    const gradeDistribution = await db.query(`
      SELECT 
        g.grade,
        COUNT(*) as count
      FROM grades g
      JOIN submissions s ON g.submission_id = s.id
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.course_id = ?
      GROUP BY g.grade
      ORDER BY g.grade
    `, [courseId]);

    return {
      course: course[0],
      studentPerformance,
      assignmentStats,
      gradeDistribution,
      generated_at: new Date(),
      total_students: studentPerformance.length,
      total_assignments: assignmentStats.length,
      average_class_score: studentPerformance.length > 0 ? 
        studentPerformance.reduce((sum, student) => sum + (student.average_score || 0), 0) / studentPerformance.length : 0
    };
  }

  // Create new assignment
  static async createAssignment(assignmentData) {
    const {
      course_id,
      teacher_id,
      title,
      description,
      instructions,
      max_points,
      due_date,
      allowed_extensions,
      max_file_size,
      submission_type
    } = assignmentData;

    const result = await db.query(`
      INSERT INTO assignments (
        course_id, teacher_id, title, description, instructions, max_points,
        due_date, allowed_extensions, max_file_size, submission_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `, [
      course_id, teacher_id, title, description, instructions, max_points,
      due_date, allowed_extensions, max_file_size, submission_type
    ]);

    return result.insertId;
  }

  // Publish assignment
  static async publishAssignment(assignmentId, instructorId) {
    // Verify ownership
    const assignment = await db.query(`
      SELECT a.* FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE a.id = ? AND c.teacher_id = ?
    `, [assignmentId, instructorId]);

    if (assignment.length === 0) {
      throw new Error('Assignment not found or access denied');
    }

    await db.query(
      'UPDATE assignments SET status = "published", updated_at = NOW() WHERE id = ?',
      [assignmentId]
    );

    // Create notifications for enrolled students
    const students = await db.query(`
      SELECT u.id as student_id, u.name 
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      WHERE e.course_id = ? AND e.status = 'active'
    `, [assignment[0].course_id]);

    for (const student of students) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (?, 'New Assignment', ?, 'info', ?, 'assignment')
      `, [
        student.student_id,
        `A new assignment "${assignment[0].title}" has been posted in your course.`,
        assignmentId
      ]);
    }

    return { success: true, notified_students: students.length };
  }
}

module.exports = Instructor;