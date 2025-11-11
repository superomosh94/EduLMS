const db = require('../../config/database');
const User = require('./User');

class Admin {
  // Get comprehensive system statistics
  static async getSystemStatistics() {
    const [
      userStats,
      courseStats,
      paymentStats,
      assignmentStats,
      recentActivity
    ] = await Promise.all([
      // User statistics
      db.query(`
        SELECT 
          r.name as role,
          COUNT(*) as count,
          COUNT(CASE WHEN u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as recent_count
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1
        GROUP BY r.name
      `),
      
      // Course statistics
      db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(current_students) as total_students,
          AVG(fee_amount) as avg_fee,
          SUM(fee_amount * current_students) as estimated_revenue
        FROM courses
        GROUP BY status
      `),
      
      // Payment statistics
      db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM payments
        GROUP BY status
      `),
      
      // Assignment statistics
      db.query(`
        SELECT 
          a.status,
          COUNT(*) as count,
          COUNT(DISTINCT s.id) as total_submissions,
          COUNT(DISTINCT g.id) as graded_submissions
        FROM assignments a
        LEFT JOIN submissions s ON a.id = s.assignment_id
        LEFT JOIN grades g ON s.id = g.submission_id
        GROUP BY a.status
      `),
      
      // Recent activity
      db.query(`
        SELECT 
          action,
          COUNT(*) as count,
          MAX(created_at) as last_activity
        FROM audit_logs
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `)
    ]);

    // Get system health metrics
    const systemHealth = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE last_login >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as active_users,
        (SELECT COUNT(*) FROM notifications WHERE is_read = 0) as unread_notifications,
        (SELECT COUNT(*) FROM assignments WHERE due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) as upcoming_assignments,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending') as pending_payments
    `);

    return {
      users: userStats,
      courses: courseStats,
      payments: paymentStats,
      assignments: assignmentStats,
      recentActivity,
      systemHealth: systemHealth[0] || {}
    };
  }

  // Get user management statistics
  static async getUserManagementStats() {
    const stats = await Promise.all([
      // Registration trends
      db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as registrations,
          COUNT(CASE WHEN role_id = (SELECT id FROM roles WHERE name = 'student') THEN 1 END) as students,
          COUNT(CASE WHEN role_id = (SELECT id FROM roles WHERE name = 'instructor') THEN 1 END) as instructors
        FROM users
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),
      
      // User activity
      db.query(`
        SELECT 
          r.name as role,
          COUNT(*) as total_users,
          COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as active_7_days,
          COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_30_days,
          AVG(TIMESTAMPDIFF(DAY, created_at, COALESCE(last_login, created_at))) as avg_days_to_first_login
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1
        GROUP BY r.name
      `),
      
      // Department statistics for instructors
      db.query(`
        SELECT 
          c.department,
          COUNT(DISTINCT c.teacher_id) as instructors_count,
          COUNT(DISTINCT c.id) as courses_count,
          SUM(c.current_students) as students_count
        FROM courses c
        WHERE c.department IS NOT NULL
        GROUP BY c.department
        ORDER BY students_count DESC
      `)
    ]);

    return {
      registrationTrends: stats[0],
      userActivity: stats[1],
      departmentStats: stats[2]
    };
  }

  // Get financial overview
  static async getFinancialOverview(timeframe = 'month') {
    const timeIntervals = {
      'day': 'INTERVAL 1 DAY',
      'week': 'INTERVAL 7 DAY',
      'month': 'INTERVAL 30 DAY',
      'year': 'INTERVAL 1 YEAR'
    };

    const interval = timeIntervals[timeframe] || timeIntervals.month;

    const [
      revenueStats,
      feeTypeStats,
      paymentMethodStats,
      outstandingFees
    ] = await Promise.all([
      // Revenue statistics
      db.query(`
        SELECT 
          DATE(payment_date) as date,
          COUNT(*) as transactions,
          SUM(amount) as total_revenue,
          AVG(amount) as avg_transaction
        FROM payments
        WHERE status = 'completed' 
          AND payment_date >= DATE_SUB(NOW(), ${interval})
        GROUP BY DATE(payment_date)
        ORDER BY date DESC
      `),
      
      // Fee type statistics
      db.query(`
        SELECT 
          fs.fee_type,
          COUNT(p.id) as transactions,
          SUM(p.amount) as total_amount,
          AVG(p.amount) as avg_amount
        FROM payments p
        JOIN fee_structures fs ON p.fee_structure_id = fs.id
        WHERE p.status = 'completed'
          AND p.payment_date >= DATE_SUB(NOW(), ${interval})
        GROUP BY fs.fee_type
        ORDER BY total_amount DESC
      `),
      
      // Payment method statistics
      db.query(`
        SELECT 
          payment_method,
          COUNT(*) as transactions,
          SUM(amount) as total_amount,
          (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM payments WHERE status = 'completed' AND payment_date >= DATE_SUB(NOW(), ${interval}))) as percentage
        FROM payments
        WHERE status = 'completed'
          AND payment_date >= DATE_SUB(NOW(), ${interval})
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `),
      
      // Outstanding fees
      db.query(`
        SELECT 
          u.student_id,
          u.name as student_name,
          u.email,
          SUM(fs.amount) as total_due,
          COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_paid,
          (SUM(fs.amount) - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)) as outstanding_balance
        FROM users u
        CROSS JOIN fee_structures fs
        LEFT JOIN payments p ON u.id = p.student_id AND p.fee_structure_id = fs.id
        WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
          AND u.is_active = 1
          AND fs.is_active = 1
        GROUP BY u.id
        HAVING outstanding_balance > 0
        ORDER BY outstanding_balance DESC
        LIMIT 20
      `)
    ]);

    return {
      revenueStats,
      feeTypeStats,
      paymentMethodStats,
      outstandingFees
    };
  }

  // Get academic performance overview
  static async getAcademicOverview() {
    const [
      gradeDistribution,
      coursePerformance,
      instructorPerformance,
      submissionTrends
    ] = await Promise.all([
      // Grade distribution
      db.query(`
        SELECT 
          g.grade,
          COUNT(*) as count,
          (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM grades)) as percentage
        FROM grades g
        GROUP BY g.grade
        ORDER BY g.grade
      `),
      
      // Course performance
      db.query(`
        SELECT 
          c.course_code,
          c.title,
          c.department,
          u.name as instructor_name,
          COUNT(DISTINCT e.student_id) as enrolled_students,
          AVG(g.grade_points) as average_grade,
          COUNT(DISTINCT a.id) as assignments_count,
          COUNT(DISTINCT s.id) as submissions_count,
          ROUND((COUNT(DISTINCT s.id) * 100.0 / (COUNT(DISTINCT a.id) * COUNT(DISTINCT e.student_id))), 2) as submission_rate
        FROM courses c
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        LEFT JOIN assignments a ON c.id = a.course_id
        LEFT JOIN submissions s ON a.id = s.assignment_id
        LEFT JOIN grades g ON s.id = g.submission_id
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY average_grade DESC
        LIMIT 20
      `),
      
      // Instructor performance
      db.query(`
        SELECT 
          u.teacher_id,
          u.name,
          u.email,
          COUNT(DISTINCT c.id) as courses_taught,
          COUNT(DISTINCT e.student_id) as total_students,
          AVG(g.grade_points) as average_student_grade,
          COUNT(DISTINCT a.id) as assignments_created,
          COUNT(DISTINCT s.id) as submissions_graded,
          ROUND((COUNT(DISTINCT g.id) * 100.0 / COUNT(DISTINCT s.id)), 2) as grading_completion_rate
        FROM users u
        LEFT JOIN courses c ON u.id = c.teacher_id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        LEFT JOIN assignments a ON c.id = a.course_id
        LEFT JOIN submissions s ON a.id = s.assignment_id
        LEFT JOIN grades g ON s.id = g.submission_id AND g.teacher_id = u.id
        WHERE u.role_id = (SELECT id FROM roles WHERE name = 'instructor')
          AND u.is_active = 1
        GROUP BY u.id
        ORDER BY average_student_grade DESC
      `),
      
      // Submission trends
      db.query(`
        SELECT 
          DATE(s.submitted_at) as date,
          COUNT(*) as submissions,
          COUNT(CASE WHEN s.is_late = 1 THEN 1 END) as late_submissions,
          ROUND((COUNT(CASE WHEN s.is_late = 1 THEN 1 END) * 100.0 / COUNT(*)), 2) as late_percentage
        FROM submissions s
        WHERE s.submitted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(s.submitted_at)
        ORDER BY date DESC
      `)
    ]);

    return {
      gradeDistribution,
      coursePerformance,
      instructorPerformance,
      submissionTrends
    };
  }

  // Bulk user operations
  static async bulkUserOperation(operation, userIds, data = {}) {
    let result;
    
    switch (operation) {
      case 'activate':
        result = await db.query(
          'UPDATE users SET is_active = 1, updated_at = NOW() WHERE id IN (?)',
          [userIds]
        );
        break;
        
      case 'deactivate':
        result = await db.query(
          'UPDATE users SET is_active = 0, updated_at = NOW() WHERE id IN (?)',
          [userIds]
        );
        break;
        
      case 'change_role':
        if (!data.role_id) throw new Error('Role ID is required');
        result = await db.query(
          'UPDATE users SET role_id = ?, updated_at = NOW() WHERE id IN (?)',
          [data.role_id, userIds]
        );
        break;
        
      default:
        throw new Error('Invalid operation');
    }

    // Log the bulk operation
    await db.query(
      `INSERT INTO audit_logs (action, table_name, details, ip_address) 
       VALUES (?, 'users', ?, 'SYSTEM')`,
      [`bulk_${operation}`, JSON.stringify({ user_count: userIds.length, data })]
    );

    return { affectedRows: result.affectedRows };
  }

  // System maintenance operations
  static async runSystemMaintenance() {
    const operations = [];
    
    // Clean up old notifications (older than 90 days)
    const notificationCleanup = await db.query(
      'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) AND is_read = 1'
    );
    operations.push({ operation: 'notification_cleanup', affected: notificationCleanup.affectedRows });
    
    // Archive completed courses (older than 1 year)
    const courseArchive = await db.query(
      'UPDATE courses SET status = "completed" WHERE status = "active" AND end_date < DATE_SUB(NOW(), INTERVAL 1 YEAR)'
    );
    operations.push({ operation: 'course_archive', affected: courseArchive.affectedRows });
    
    // Clean up expired sessions (implementation depends on session storage)
    operations.push({ operation: 'session_cleanup', affected: 'N/A' });
    
    // Update system statistics cache
    operations.push({ operation: 'statistics_refresh', affected: 'N/A' });
    
    return operations;
  }

  // Get system audit logs
  static async getAuditLogs(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs al`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.action) {
      whereConditions.push('al.action LIKE ?');
      params.push(`%${filters.action}%`);
    }

    if (filters.user_id) {
      whereConditions.push('al.user_id = ?');
      params.push(filters.user_id);
    }

    if (filters.start_date) {
      whereConditions.push('al.created_at >= ?');
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      whereConditions.push('al.created_at <= ?');
      params.push(filters.end_date);
    }

    if (filters.ip_address) {
      whereConditions.push('al.ip_address LIKE ?');
      params.push(`%${filters.ip_address}%`);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [logs, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      logs,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Export system data
  static async exportSystemData(dataType, format = 'json') {
    let query;
    
    switch (dataType) {
      case 'users':
        query = `
          SELECT 
            u.*, 
            r.name as role_name,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
            DATE_FORMAT(u.last_login, '%Y-%m-%d %H:%i:%s') as last_login_formatted
          FROM users u
          JOIN roles r ON u.role_id = r.id
          ORDER BY u.created_at DESC
        `;
        break;
        
      case 'courses':
        query = `
          SELECT 
            c.*,
            u.name as instructor_name,
            COUNT(DISTINCT e.id) as enrolled_students_count
          FROM courses c
          JOIN users u ON c.teacher_id = u.id
          LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `;
        break;
        
      case 'payments':
        query = `
          SELECT 
            p.*,
            u.name as student_name,
            u.student_id,
            fs.name as fee_name,
            fs.fee_type,
            verifier.name as verified_by_name,
            DATE_FORMAT(p.payment_date, '%Y-%m-%d %H:%i:%s') as payment_date_formatted
          FROM payments p
          JOIN users u ON p.student_id = u.id
          LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
          LEFT JOIN users verifier ON p.verified_by = verifier.id
          ORDER BY p.created_at DESC
        `;
        break;
        
      default:
        throw new Error('Invalid data type for export');
    }

    const data = await db.query(query);
    
    if (format === 'csv') {
      // Convert to CSV format
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => 
        Object.values(row).map(value => 
          `"${String(value || '').replace(/"/g, '""')}"`
        ).join(',')
      );
      
      return [headers, ...rows].join('\n');
    }
    
    return data;
  }
}

module.exports = Admin;