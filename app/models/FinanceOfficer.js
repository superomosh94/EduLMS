const db = require('../../config/database');

class FinanceOfficer {
  // Get financial dashboard overview
  static async getFinancialOverview(timeframe = 'month') {
    const timeIntervals = {
      'today': 'INTERVAL 1 DAY',
      'week': 'INTERVAL 7 DAY',
      'month': 'INTERVAL 30 DAY',
      'year': 'INTERVAL 1 YEAR'
    };

    const interval = timeIntervals[timeframe] || timeIntervals.month;

    const [
      summary,
      recentTransactions,
      feeTypeSummary,
      paymentTrends
    ] = await Promise.all([
      // Financial summary
      db.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed_amount,
          AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_transaction_amount,
          COUNT(CASE WHEN status = 'completed' AND payment_date >= DATE_SUB(NOW(), ${interval}) THEN 1 END) as recent_transactions,
          SUM(CASE WHEN status = 'completed' AND payment_date >= DATE_SUB(NOW(), ${interval}) THEN amount ELSE 0 END) as recent_revenue
        FROM payments
      `),
      
      // Recent transactions
      db.query(`
        SELECT 
          p.*,
          u.name as student_name,
          u.student_id,
          fs.name as fee_name,
          fs.fee_type,
          verifier.name as verified_by_name
        FROM payments p
        JOIN users u ON p.student_id = u.id
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        LEFT JOIN users verifier ON p.verified_by = verifier.id
        ORDER BY p.created_at DESC
        LIMIT 10
      `),
      
      // Fee type summary
      db.query(`
        SELECT 
          COALESCE(fs.fee_type, 'Other') as fee_type,
          COUNT(p.id) as transaction_count,
          SUM(p.amount) as total_amount,
          AVG(p.amount) as average_amount,
          (SUM(p.amount) * 100.0 / (SELECT SUM(amount) FROM payments WHERE status = 'completed')) as percentage
        FROM payments p
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        WHERE p.status = 'completed'
        GROUP BY fs.fee_type
        ORDER BY total_amount DESC
      `),
      
      // Payment trends
      db.query(`
        SELECT 
          DATE(payment_date) as date,
          COUNT(*) as transaction_count,
          SUM(amount) as daily_revenue,
          AVG(amount) as avg_transaction
        FROM payments
        WHERE status = 'completed' 
          AND payment_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(payment_date)
        ORDER BY date DESC
      `)
    ]);

    return {
      summary: summary[0] || {},
      recentTransactions,
      feeTypeSummary,
      paymentTrends
    };
  }

  // Get student fee statements
  static async getStudentFeeStatements(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        u.id as student_id,
        u.student_id as student_code,
        u.name as student_name,
        u.email,
        u.phone,
        SUM(fs.amount) as total_fees_due,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_paid,
        (SUM(fs.amount) - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)) as outstanding_balance,
        COUNT(DISTINCT fs.id) as total_fee_types,
        COUNT(DISTINCT p.id) as total_transactions,
        MAX(p.payment_date) as last_payment_date
      FROM users u
      CROSS JOIN fee_structures fs
      LEFT JOIN payments p ON u.id = p.student_id AND p.fee_structure_id = fs.id
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
        AND u.is_active = 1
        AND fs.is_active = 1
    `;
    
    let countQuery = `
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
        AND u.is_active = 1
    `;
    
    const params = [];
    const havingConditions = [];

    // Apply filters
    if (filters.outstanding_only) {
      havingConditions.push('outstanding_balance > 0');
    }

    if (filters.student_search) {
      query += ` AND (u.name LIKE ? OR u.student_id LIKE ? OR u.email LIKE ?)`;
      countQuery += ` AND (u.name LIKE ? OR u.student_id LIKE ? OR u.email LIKE ?)`;
      params.push(`%${filters.student_search}%`, `%${filters.student_search}%`, `%${filters.student_search}%`);
    }

    query += ` GROUP BY u.id`;

    // Apply HAVING conditions
    if (havingConditions.length > 0) {
      query += ` HAVING ` + havingConditions.join(' AND ');
    }

    query += ` ORDER BY outstanding_balance DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [statements, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      statements,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Get detailed student payment history
  static async getStudentPaymentHistory(studentId) {
    const [payments, feeSummary, overallSummary] = await Promise.all([
      // Payment history
      db.query(`
        SELECT 
          p.*,
          fs.name as fee_name,
          fs.fee_type,
          fs.description as fee_description,
          verifier.name as verified_by_name,
          CASE 
            WHEN p.status = 'completed' THEN 'success'
            WHEN p.status = 'pending' THEN 'warning'
            WHEN p.status = 'failed' THEN 'danger'
            ELSE 'secondary'
          END as status_class
        FROM payments p
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        LEFT JOIN users verifier ON p.verified_by = verifier.id
        WHERE p.student_id = ?
        ORDER BY p.created_at DESC
      `, [studentId]),
      
      // Fee type summary
      db.query(`
        SELECT 
          fs.fee_type,
          fs.name as fee_name,
          fs.amount as fee_amount,
          COUNT(p.id) as payment_count,
          COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as amount_paid,
          (fs.amount - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)) as amount_due
        FROM fee_structures fs
        LEFT JOIN payments p ON fs.id = p.fee_structure_id AND p.student_id = ?
        WHERE fs.is_active = 1
        GROUP BY fs.id
        ORDER BY fs.fee_type
      `, [studentId]),
      
      // Overall summary
      db.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
          SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed,
          AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_payment_amount,
          MIN(payment_date) as first_payment_date,
          MAX(payment_date) as last_payment_date
        FROM payments
        WHERE student_id = ?
      `, [studentId])
    ]);

    const student = await db.query(`
      SELECT id, student_id, name, email, phone, admission_date 
      FROM users 
      WHERE id = ?
    `, [studentId]);

    return {
      student: student[0],
      payments,
      feeSummary,
      overallSummary: overallSummary[0] || {}
    };
  }

  // Verify and update payment status
  static async verifyPayment(paymentId, financeOfficerId, status, notes = '') {
    // Get payment details
    const payment = await db.query(`
      SELECT * FROM payments WHERE id = ?
    `, [paymentId]);

    if (payment.length === 0) {
      throw new Error('Payment not found');
    }

    const validStatuses = ['completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid payment status');
    }

    // Update payment status
    const result = await db.query(`
      UPDATE payments 
      SET status = ?, verified_by = ?, verified_at = NOW(), description = CONCAT(COALESCE(description, ''), ?)
      WHERE id = ?
    `, [status, financeOfficerId, notes ? ` | Verified: ${notes}` : '', paymentId]);

    if (result.affectedRows === 0) {
      throw new Error('Failed to update payment');
    }

    // Create notification for student
    if (status === 'completed') {
      await db.query(`
        INSERT INTO notifications (user_id, title, message, type, related_id, related_type)
        VALUES (?, 'Payment Verified', ?, 'success', ?, 'payment')
      `, [
        payment[0].student_id,
        `Your payment of KES ${payment[0].amount} has been verified and processed successfully.`,
        paymentId
      ]);
    }

    // Log the verification
    await db.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
      VALUES (?, 'payment_verification', 'payments', ?, ?)
    `, [financeOfficerId, paymentId, JSON.stringify({ old_status: payment[0].status, new_status: status, notes })]);

    return { success: true, payment: { ...payment[0], status, verified_by: financeOfficerId } };
  }

  // Manage fee structures
  static async manageFeeStructures(operation, feeData = {}, feeId = null) {
    switch (operation) {
      case 'create':
        return await this.createFeeStructure(feeData);
        
      case 'update':
        if (!feeId) throw new Error('Fee ID is required for update');
        return await this.updateFeeStructure(feeId, feeData);
        
      case 'delete':
        if (!feeId) throw new Error('Fee ID is required for delete');
        return await this.deleteFeeStructure(feeId);
        
      case 'list':
        return await this.getFeeStructures(feeData);
        
      default:
        throw new Error('Invalid operation');
    }
  }

  // Create new fee structure
  static async createFeeStructure(feeData) {
    const {
      name,
      description,
      amount,
      fee_type,
      academic_year,
      semester,
      due_date,
      created_by
    } = feeData;

    const result = await db.query(`
      INSERT INTO fee_structures (name, description, amount, fee_type, academic_year, semester, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, description, amount, fee_type, academic_year, semester, due_date, created_by]);

    // Log the creation
    await db.query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
      VALUES (?, 'fee_structure_create', 'fee_structures', ?, ?)
    `, [created_by, result.insertId, JSON.stringify(feeData)]);

    return result.insertId;
  }

  // Update fee structure
  static async updateFeeStructure(feeId, updateData) {
    const allowedFields = ['name', 'description', 'amount', 'fee_type', 'academic_year', 'semester', 'due_date', 'is_active'];
    
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
    const values = [...Object.values(fieldsToUpdate), feeId];

    await db.query(
      `UPDATE fee_structures SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return { success: true };
  }

  // Delete fee structure
  static async deleteFeeStructure(feeId) {
    // Check if fee structure has associated payments
    const payments = await db.query(
      'SELECT COUNT(*) as count FROM payments WHERE fee_structure_id = ?',
      [feeId]
    );

    if (payments[0].count > 0) {
      throw new Error('Cannot delete fee structure with associated payments. Deactivate instead.');
    }

    await db.query('DELETE FROM fee_structures WHERE id = ?', [feeId]);
    return { success: true };
  }

  // Get fee structures with filtering
  static async getFeeStructures(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        fs.*,
        u.name as created_by_name,
        COUNT(p.id) as payment_count,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_collected
      FROM fee_structures fs
      LEFT JOIN users u ON fs.created_by = u.id
      LEFT JOIN payments p ON fs.id = p.fee_structure_id
    `;
    
    let countQuery = `SELECT COUNT(*) as total FROM fee_structures fs`;
    const params = [];
    const whereConditions = [];

    // Apply filters
    if (filters.fee_type) {
      whereConditions.push('fs.fee_type = ?');
      params.push(filters.fee_type);
    }

    if (filters.academic_year) {
      whereConditions.push('fs.academic_year = ?');
      params.push(filters.academic_year);
    }

    if (filters.semester) {
      whereConditions.push('fs.semester = ?');
      params.push(filters.semester);
    }

    if (filters.is_active !== undefined) {
      whereConditions.push('fs.is_active = ?');
      params.push(filters.is_active);
    }

    if (filters.search) {
      whereConditions.push('(fs.name LIKE ? OR fs.description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Build WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` GROUP BY fs.id ORDER BY fs.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [feeStructures, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, params.slice(0, -2))
    ]);

    return {
      feeStructures,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / limit)
    };
  }

  // Generate financial reports
  static async generateFinancialReport(reportType, filters = {}) {
    let reportData;
    
    switch (reportType) {
      case 'revenue_summary':
        reportData = await this.generateRevenueSummary(filters);
        break;
        
      case 'fee_collection':
        reportData = await this.generateFeeCollectionReport(filters);
        break;
        
      case 'outstanding_fees':
        reportData = await this.generateOutstandingFeesReport(filters);
        break;
        
      case 'payment_methods':
        reportData = await this.generatePaymentMethodsReport(filters);
        break;
        
      default:
        throw new Error('Invalid report type');
    }

    return {
      reportType,
      generated_at: new Date(),
      filters,
      ...reportData
    };
  }

  // Generate revenue summary report
  static async generateRevenueSummary(filters) {
    const { start_date, end_date, fee_type } = filters;
    
    let query = `
      SELECT 
        DATE(p.payment_date) as date,
        COUNT(*) as transaction_count,
        SUM(p.amount) as daily_revenue,
        AVG(p.amount) as avg_transaction,
        COUNT(DISTINCT p.student_id) as unique_payers,
        fs.fee_type
      FROM payments p
      LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
      WHERE p.status = 'completed'
    `;
    
    const params = [];

    if (start_date) {
      query += ` AND p.payment_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND p.payment_date <= ?`;
      params.push(end_date);
    }

    if (fee_type) {
      query += ` AND fs.fee_type = ?`;
      params.push(fee_type);
    }

    query += ` GROUP BY DATE(p.payment_date), fs.fee_type ORDER BY date DESC`;

    const revenueData = await db.query(query, params);

    // Summary statistics
    const summary = await db.query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(amount) as total_revenue,
        AVG(amount) as overall_avg_transaction,
        COUNT(DISTINCT student_id) as total_unique_payers,
        MIN(payment_date) as period_start,
        MAX(payment_date) as period_end
      FROM payments
      WHERE status = 'completed'
        ${start_date ? 'AND payment_date >= ?' : ''}
        ${end_date ? 'AND payment_date <= ?' : ''}
    `, [start_date, end_date].filter(Boolean));

    return {
      revenueData,
      summary: summary[0] || {}
    };
  }

  // Generate outstanding fees report
  static async generateOutstandingFeesReport(filters) {
    const { department, min_balance } = filters;
    
    let query = `
      SELECT 
        u.student_id,
        u.name as student_name,
        u.email,
        u.phone,
        c.department,
        SUM(fs.amount) as total_due,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_paid,
        (SUM(fs.amount) - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)) as outstanding_balance,
        COUNT(DISTINCT fs.id) as fee_types_count,
        MAX(fs.due_date) as latest_due_date
      FROM users u
      CROSS JOIN fee_structures fs
      LEFT JOIN payments p ON u.id = p.student_id AND p.fee_structure_id = fs.id
      LEFT JOIN enrollments e ON u.id = e.student_id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
        AND u.is_active = 1
        AND fs.is_active = 1
    `;
    
    const params = [];
    const havingConditions = ['outstanding_balance > 0'];

    if (department) {
      query += ` AND c.department = ?`;
      params.push(department);
    }

    if (min_balance) {
      havingConditions.push('outstanding_balance >= ?');
      params.push(min_balance);
    }

    query += ` GROUP BY u.id`;

    if (havingConditions.length > 0) {
      query += ` HAVING ` + havingConditions.join(' AND ');
    }

    query += ` ORDER BY outstanding_balance DESC`;

    const outstandingFees = await db.query(query, params);

    // Summary
    const summary = {
      total_students: outstandingFees.length,
      total_outstanding: outstandingFees.reduce((sum, student) => sum + student.outstanding_balance, 0),
      average_balance: outstandingFees.length > 0 ? 
        outstandingFees.reduce((sum, student) => sum + student.outstanding_balance, 0) / outstandingFees.length : 0
    };

    return {
      outstandingFees,
      summary
    };
  }

  // Generate fee collection report
  static async generateFeeCollectionReport(filters) {
    const { academic_year, semester } = filters;
    
    let query = `
      SELECT 
        fs.fee_type,
        fs.name as fee_name,
        fs.amount as standard_amount,
        COUNT(p.id) as transaction_count,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_collected,
        COUNT(DISTINCT p.student_id) as unique_payers,
        (COUNT(p.id) * 100.0 / (SELECT COUNT(*) FROM payments WHERE status = 'completed')) as percentage_of_total
      FROM fee_structures fs
      LEFT JOIN payments p ON fs.id = p.fee_structure_id AND p.status = 'completed'
    `;
    
    const params = [];
    const whereConditions = [];

    if (academic_year) {
      whereConditions.push('fs.academic_year = ?');
      params.push(academic_year);
    }

    if (semester) {
      whereConditions.push('fs.semester = ?');
      params.push(semester);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(' AND ');
    }

    query += ` GROUP BY fs.id ORDER BY total_collected DESC`;

    const collectionData = await db.query(query, params);

    return { collectionData };
  }

  // Generate payment methods report
  static async generatePaymentMethodsReport(filters) {
    const { start_date, end_date } = filters;
    
    let query = `
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM payments WHERE status = 'completed')) as transaction_percentage,
        (SUM(amount) * 100.0 / (SELECT SUM(amount) FROM payments WHERE status = 'completed')) as amount_percentage,
        MIN(payment_date) as first_transaction,
        MAX(payment_date) as last_transaction
      FROM payments
      WHERE status = 'completed'
    `;
    
    const params = [];

    if (start_date) {
      query += ` AND payment_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND payment_date <= ?`;
      params.push(end_date);
    }

    query += ` GROUP BY payment_method ORDER BY total_amount DESC`;

    const paymentMethods = await db.query(query, params);

    return { paymentMethods };
  }
}

module.exports = FinanceOfficer;