const db = require('../../config/database');
const { SUBMISSION_STATUS } = require('../../config/constants');

class Submission {
  // Create submission with validation
  static async create(submissionData) {
    const {
      assignment_id,
      student_id,
      submission_text = null,
      file_path = null,
      file_name = null,
      file_size = null
    } = submissionData;

    // Check if already submitted
    const existing = await db.query(`
      SELECT id FROM submissions 
      WHERE assignment_id = ? AND student_id = ?
    `, [assignment_id, student_id]);

    if (existing.length > 0) {
      throw new Error('You have already submitted this assignment');
    }

    // Get assignment details for validation
    const assignment = await db.query(`
      SELECT a.*, c.title as course_title
      FROM assignments a
      JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `, [assignment_id]);

    if (assignment.length === 0) {
      throw new Error('Assignment not found');
    }

    if (assignment[0].status !== 'published') {
      throw new Error('Assignment is not available for submission');
    }

    // Check due date
    const isLate = new Date() > new Date(assignment[0].due_date);
    const status = isLate ? 'late' : 'submitted';

    // Validate submission type
    if (assignment[0].submission_type === 'text' && !submission_text) {
      throw new Error('Text submission is required for this assignment');
    }

    if (assignment[0].submission_type === 'file' && !file_path) {
      throw new Error('File upload is required for this assignment');
    }

    if (assignment[0].submission_type === 'both' && !submission_text && !file_path) {
      throw new Error('Either text submission or file upload is required');
    }

    // Validate file size if file is uploaded
    if (file_size && file_size > assignment[0].max_file_size) {
      throw new Error(`File size exceeds maximum allowed size of ${assignment[0].max_file_size} bytes`);
    }

    const result = await db.query(`
      INSERT INTO submissions (
        assignment_id, student_id, submission_text, file_path, file_name, file_size, status, is_late
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      assignment_id, student_id, submission_text, file_path, file_name, file_size, status, isLate
    ]);

    // Create notification for instructor
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (?, 'New Submission', ?, 'info', ?, 'submission')
    `, [
      assignment[0].teacher_id,
      `A new submission for "${assignment[0].title}" has been received from a student.`,
      result.insertId
    ]);

    return {
      submissionId: result.insertId,
      isLate,
      status
    };
  }

  // Find submission by ID with details
  static async findById(id) {
    const submissions = await db.query(`
      SELECT 
        s.*,
        a.title as assignment_title,
        a.max_points,
        a.due_date,
        a.submission_type,
        c.title as course_title,
        c.course_code,
        u.name as student_name,
        u.student_id,
        u.email as student_email,
        g.points_earned,
        g.grade,
        g.feedback,
        g.graded_at,
        inst.name as instructor_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON s.student_id = u.id
      JOIN users inst ON a.teacher_id = inst.id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE s.id = ?
    `, [id]);

    return submissions[0] || null;
  }

  // Get submissions with filtering
  static async findAll(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        s.*,
        a.title as assignment_title,
        a.max_points,
        a.due_date,
        c.title as course_title,
        c.course_code,
        u.name as student_name,
        u.student_id,
        g.points_earned,
        g.grade,
        g.feedback,
        g.graded_at,
        inst.name as instructor_name,
        CASE 
          WHEN g.id IS NOT NULL THEN 'graded'
          WHEN s.id IS NOT NULL THEN 'submitted'
          ELSE 'missing'
        END as grading_status
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      JOIN users u ON s.student_id = u.id
      JOIN users inst ON a.teacher_id = inst.id
      LEFT JOIN grades g ON s.id = g.submission_id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM submissions s`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.assignment_id) {
      whereConditions.push('s.assignment_id = ?');
      params.push(filters.assignment_id);
    }

    if (filters.student_id) {
      whereConditions.push('s.student_id = ?');
      params.push(filters.student_id);
    }

    if (filters.course_id) {
      whereConditions.push('a.course_id = ?');
      params.push(filters.course_id);
    }

    if (filters.status) {
      whereConditions.push('s.status = ?');
      params.push(filters.status);
    }

    if (filters.is_late !== undefined) {
      whereConditions.push('s.is_late = ?');
      params.push(filters.is_late);
    }

    if (filters.grading_status === 'graded') {
      whereConditions.push('g.id IS NOT NULL');
    } else if (filters.grading_status === 'submitted') {
      whereConditions.push('g.id IS NULL');
    }

    if (filters.search) {
      whereConditions.push('(u.name LIKE ? OR u.student_id LIKE ? OR a.title LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [submissions, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      submissions,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Update submission
  static async update(id, updateData) {
    const allowedFields = ['submission_text', 'file_path', 'file_name', 'file_size', 'status'];
    
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
      `UPDATE submissions SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  // Delete submission
  static async delete(id) {
    // Check if submission has been graded
    const grade = await db.query(
      'SELECT id FROM grades WHERE submission_id = ?',
      [id]
    );

    if (grade.length > 0) {
      throw new Error('Cannot delete submission that has been graded');
    }

    await db.query('DELETE FROM submissions WHERE id = ?', [id]);
    return { success: true };
  }

  // Get submission statistics for assignment
  static async getAssignmentStatistics(assignmentId) {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN s.is_late = 1 THEN 1 END) as late_submissions,
        COUNT(CASE WHEN g.id IS NOT NULL THEN 1 END) as graded_submissions,
        AVG(g.points_earned) as average_score,
        MAX(g.points_earned) as highest_score,
        MIN(g.points_earned) as lowest_score,
        COUNT(DISTINCT e.id) as total_students,
        ROUND((COUNT(*) * 100.0 / COUNT(DISTINCT e.id)), 2) as submission_rate
      FROM assignments a
      LEFT JOIN enrollments e ON a.course_id = e.course_id AND e.status = 'active'
      LEFT JOIN submissions s ON a.id = s.assignment_id
      LEFT JOIN grades g ON s.id = g.submission_id
      WHERE a.id = ?
    `, [assignmentId]);

    const timeline = await db.query(`
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
      timeline
    };
  }

  // Get student's submission history
  static async getStudentSubmissions(studentId, filters = {}) {
    let query = `
      SELECT 
        s.*,
        a.title as assignment_title,
        a.max_points,
        a.due_date,
        c.title as course_title,
        c.course_code,
        g.points_earned,
        g.grade,
        g.feedback,
        g.graded_at,
        inst.name as instructor_name,
        CASE 
          WHEN g.id IS NOT NULL THEN 'graded'
          WHEN s.id IS NOT NULL THEN 'submitted'
          ELSE 'not_submitted'
        END as submission_status
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN assignments a ON c.id = a.course_id AND a.status = 'published'
      LEFT JOIN submissions s ON a.id = s.assignment_id AND s.student_id = e.student_id
      LEFT JOIN grades g ON s.id = g.submission_id
      JOIN users inst ON c.teacher_id = inst.id
      WHERE e.student_id = ? AND e.status = 'active'
    `;

    const params = [studentId];

    if (filters.course_id) {
      query += ` AND c.id = ?`;
      params.push(filters.course_id);
    }

    if (filters.status === 'submitted') {
      query += ` AND s.id IS NOT NULL`;
    } else if (filters.status === 'missing') {
      query += ` AND s.id IS NULL AND a.due_date < NOW()`;
    } else if (filters.status === 'upcoming') {
      query += ` AND s.id IS NULL AND a.due_date > NOW()`;
    } else if (filters.status === 'graded') {
      query += ` AND g.id IS NOT NULL`;
    }

    query += ` ORDER BY a.due_date ASC`;

    const submissions = await db.query(query, params);
    return submissions;
  }

  // Resubmit assignment
  static async resubmit(submissionId, updateData) {
    const submission = await this.findById(submissionId);
    
    if (!submission) {
      throw new Error('Submission not found');
    }

    // Check if assignment is still open for submission
    if (new Date() > new Date(submission.due_date)) {
      throw new Error('Assignment submission deadline has passed');
    }

    const { submission_text, file_path, file_name, file_size } = updateData;

    // Validate file size if file is uploaded
    if (file_size && file_size > submission.max_file_size) {
      throw new Error(`File size exceeds maximum allowed size of ${submission.max_file_size} bytes`);
    }

    const isLate = new Date() > new Date(submission.due_date);
    const status = isLate ? 'late' : 'submitted';

    await db.query(`
      UPDATE submissions 
      SET submission_text = ?, file_path = ?, file_name = ?, file_size = ?, status = ?, is_late = ?, updated_at = NOW()
      WHERE id = ?
    `, [submission_text, file_path, file_name, file_size, status, isLate, submissionId]);

    // Delete existing grade if any
    await db.query('DELETE FROM grades WHERE submission_id = ?', [submissionId]);

    // Notify instructor about resubmission
    await db.query(`
      INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
      VALUES (?, 'Submission Updated', ?, 'info', ?, 'submission')
    `, [
      submission.teacher_id,
      `A student has updated their submission for "${submission.assignment_title}".`,
      submissionId
    ]);

    return { success: true, isLate, status };
  }

  // Get late submissions
  static async getLateSubmissions(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [submissions, countResult] = await Promise.all([
      db.query(`
        SELECT 
          s.*,
          a.title as assignment_title,
          a.due_date,
          c.title as course_title,
          c.course_code,
          u.name as student_name,
          u.student_id,
          g.points_earned,
          g.grade,
          TIMESTAMPDIFF(HOUR, a.due_date, s.submitted_at) as hours_late
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON s.student_id = u.id
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE s.is_late = 1
        ORDER BY s.submitted_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      
      db.query(`
        SELECT COUNT(*) as total 
        FROM submissions 
        WHERE is_late = 1
      `)
    ]);

    return {
      submissions,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Bulk download submissions for an assignment
  static async getSubmissionsForDownload(assignmentId) {
    const submissions = await db.query(`
      SELECT 
        s.*,
        u.name as student_name,
        u.student_id,
        u.email as student_email,
        a.title as assignment_title,
        c.course_code
      FROM submissions s
      JOIN users u ON s.student_id = u.id
      JOIN assignments a ON s.assignment_id = a.id
      JOIN courses c ON a.course_id = c.id
      WHERE s.assignment_id = ?
      ORDER BY u.name
    `, [assignmentId]);

    return submissions;
  }
}

module.exports = Submission;