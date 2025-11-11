const db = require('../../config/database');
const { ASSIGNMENT_STATUS } = require('../../config/constants');

class Assignment {
  // Create new assignment
  static async create(assignmentData) {
    const {
      course_id,
      teacher_id,
      title,
      description,
      instructions,
      max_points = 100.00,
      due_date,
      allowed_extensions = '.pdf,.doc,.docx,.txt',
      max_file_size = 10485760,
      submission_type = 'file',
      status = 'draft'
    } = assignmentData;

    const result = await db.query(`
      INSERT INTO assignments (
        course_id, teacher_id, title, description, instructions, max_points,
        due_date, allowed_extensions, max_file_size, submission_type, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      course_id, teacher_id, title, description, instructions, max_points,
      due_date, allowed_extensions, max_file_size, submission_type, status
    ]);

    return result.insertId;
  }

  // Find assignment by ID with comprehensive details
  static async findById(id) {
    const assignments = await db.query(`
      SELECT 
        a.*,
        c.title as course_title,
        c.course_code,
        u.name as instructor_name,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT g.id) as graded_count,
        AVG(g.points_earned) as average_score,
        MAX(g.points_earned) as highest_score,
        MIN(g.points_earned) as lowest_score
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.id = ?
      GROUP BY a.id
    `, [id]);

    return assignments[0] || null;
  }

  // Get assignments with advanced filtering
  static async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        a.*,
        c.title as course_title,
        c.course_code,
        u.name as instructor_name,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT g.id) as graded_count,
        AVG(g.points_earned) as average_score,
        (COUNT(DISTINCT s.id) - COUNT(DISTINCT g.id)) as pending_grading,
        CASE 
          WHEN a.due_date < NOW() THEN 'overdue'
          WHEN a.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) THEN 'upcoming'
          ELSE 'future'
        END as due_status
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM assignments a`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.course_id) {
      whereConditions.push('a.course_id = ?');
      params.push(filters.course_id);
    }

    if (filters.teacher_id) {
      whereConditions.push('a.teacher_id = ?');
      params.push(filters.teacher_id);
    }

    if (filters.status) {
      whereConditions.push('a.status = ?');
      params.push(filters.status);
    }

    if (filters.due_status) {
      if (filters.due_status === 'overdue') {
        whereConditions.push('a.due_date < NOW()');
      } else if (filters.due_status === 'upcoming') {
        whereConditions.push('a.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)');
      } else if (filters.due_status === 'future') {
        whereConditions.push('a.due_date > DATE_ADD(NOW(), INTERVAL 7 DAY)');
      }
    }

    if (filters.search) {
      whereConditions.push('(a.title LIKE ? OR a.description LIKE ? OR c.title LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` GROUP BY a.id ORDER BY a.due_date ASC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [assignments, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      assignments,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Update assignment
  static async update(id, updateData) {
    const allowedFields = [
      'title', 'description', 'instructions', 'max_points', 'due_date',
      'allowed_extensions', 'max_file_size', 'submission_type', 'status'
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
      `UPDATE assignments SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  // Delete assignment with validation
  static async delete(id) {
    // Check if assignment has submissions
    const submissions = await db.query(
      'SELECT COUNT(*) as count FROM submissions WHERE assignment_id = ?',
      [id]
    );

    if (submissions[0].count > 0) {
      throw new Error('Cannot delete assignment with submissions. Archive instead.');
    }

    await db.query('DELETE FROM assignments WHERE id = ?', [id]);
    return { success: true };
  }

  // Publish assignment
  static async publish(id) {
    const assignment = await this.findById(id);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    await db.query(
      'UPDATE assignments SET status = "published", updated_at = NOW() WHERE id = ?',
      [id]
    );

    // Create notifications for enrolled students
    const students = await db.query(`
      SELECT u.id as student_id, u.name 
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      WHERE e.course_id = ? AND e.status = 'active'
    `, [assignment.course_id]);

    for (const student of students) {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (?, 'New Assignment', ?, 'info', ?, 'assignment')
      `, [
        student.student_id,
        `A new assignment "${assignment.title}" has been posted in ${assignment.course_title}. Due: ${new Date(assignment.due_date).toLocaleDateString()}`,
        id
      ]);
    }

    return { success: true, notified_students: students.length };
  }

  // Close assignment (no more submissions)
  static async close(id) {
    await db.query(
      'UPDATE assignments SET status = "closed", updated_at = NOW() WHERE id = ?',
      [id]
    );

    return { success: true };
  }

  // Get assignment statistics
  static async getStatistics(assignmentId) {
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT g.id) as graded_submissions,
        AVG(g.points_earned) as average_score,
        MAX(g.points_earned) as highest_score,
        MIN(g.points_earned) as lowest_score,
        COUNT(DISTINCT CASE WHEN s.is_late = 1 THEN s.id END) as late_submissions,
        COUNT(DISTINCT e.id) as total_students,
        ROUND((COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT e.id)), 2) as submission_rate
      FROM assignments a
      LEFT JOIN enrollments e ON a.course_id = e.course_id AND e.status = 'active'
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.id = ?
    `, [assignmentId]);

    const gradeDistribution = await db.query(`
      SELECT 
        g.grade,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM grades WHERE assignment_id = ?)) as percentage
      FROM grades g
      WHERE g.assignment_id = ?
      GROUP BY g.grade
      ORDER BY g.grade
    `, [assignmentId, assignmentId]);

    const submissionTimeline = await db.query(`
      SELECT 
        DATE(s.submitted_at) as date,
        COUNT(*) as submissions,
        COUNT(CASE WHEN s.is_late = 1 THEN 1 END) as late_submissions
      FROM submissions s
      WHERE s.assignment_id = ?
      GROUP BY DATE(s.submitted_at)
      ORDER BY date
    `, [assignmentId]);

    return {
      overview: stats[0] || {},
      gradeDistribution,
      submissionTimeline
    };
  }

  // Check if student can submit to assignment
  static async canStudentSubmit(assignmentId, studentId) {
    const checks = await Promise.all([
      // Get assignment details
      this.findById(assignmentId),
      
      // Check if student is enrolled
      db.query(`
        SELECT id FROM enrollments 
        WHERE student_id = ? AND course_id = (SELECT course_id FROM assignments WHERE id = ?) AND status = 'active'
      `, [studentId, assignmentId]),
      
      // Check if already submitted
      db.query(`
        SELECT id FROM submissions 
        WHERE assignment_id = ? AND student_id = ?
      `, [assignmentId, studentId])
    ]);

    const [assignment, enrollment, existingSubmission] = checks;

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    if (assignment.status !== 'published') {
      throw new Error('Assignment is not available for submission');
    }

    if (new Date(assignment.due_date) < new Date()) {
      throw new Error('Assignment submission deadline has passed');
    }

    if (enrollment.length === 0) {
      throw new Error('You are not enrolled in this course');
    }

    if (existingSubmission.length > 0) {
      throw new Error('You have already submitted this assignment');
    }

    return {
      canSubmit: true,
      assignment,
      dueDate: assignment.due_date,
      maxFileSize: assignment.max_file_size,
      allowedExtensions: assignment.allowed_extensions
    };
  }

  // Get assignments due soon
  static async getDueSoon(days = 7) {
    const assignments = await db.query(`
      SELECT 
        a.*,
        c.title as course_title,
        c.course_code,
        u.name as instructor_name,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT e.id) as total_students,
        (COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT e.id)) as submission_rate
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN submissions s ON a.id = s.assignment_id
      WHERE a.status = 'published'
        AND a.due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? DAY)
      GROUP BY a.id
      ORDER BY a.due_date ASC
    `, [days]);

    return assignments;
  }

  // Get overdue assignments
  static async getOverdue() {
    const assignments = await db.query(`
      SELECT 
        a.*,
        c.title as course_title,
        c.course_code,
        u.name as instructor_name,
        COUNT(DISTINCT s.id) as submission_count,
        COUNT(DISTINCT e.id) as total_students,
        (COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT e.id)) as submission_rate
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON a.teacher_id = u.id
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
      LEFT JOIN submissions s ON a.id = s.assignment_id
      WHERE a.status = 'published'
        AND a.due_date < NOW()
      GROUP BY a.id
      ORDER BY a.due_date ASC
    `);

    return assignments;
  }

  // Bulk update assignment status
  static async bulkUpdateStatus(assignmentIds, status) {
    const validStatuses = ['draft', 'published', 'closed'];
    
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid assignment status');
    }

    const result = await db.query(
      'UPDATE assignments SET status = ?, updated_at = NOW() WHERE id IN (?)',
      [status, assignmentIds]
    );

    return { affectedRows: result.affectedRows };
  }

  // Get assignment submissions summary
  static async getSubmissionsSummary(assignmentId) {
    const summary = await db.query(`
      SELECT 
        COUNT(DISTINCT e.id) as total_students,
        COUNT(DISTINCT s.id) as submissions_count,
        COUNT(DISTINCT g.id) as graded_count,
        COUNT(DISTINCT CASE WHEN s.is_late = 1 THEN s.id END) as late_submissions,
        AVG(g.points_earned) as average_score,
        MAX(g.points_earned) as highest_score,
        MIN(g.points_earned) as lowest_score,
        ROUND((COUNT(DISTINCT s.id) * 100.0 / COUNT(DISTINCT e.id)), 2) as submission_rate,
        ROUND((COUNT(DISTINCT g.id) * 100.0 / COUNT(DISTINCT s.id)), 2) as grading_completion_rate
      FROM assignments a
      LEFT JOIN enrollments e ON a.course_id = e.course_id AND e.status = 'active'
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.id = ?
    `, [assignmentId]);

    return summary[0] || {};
  }
}

module.exports = Assignment;