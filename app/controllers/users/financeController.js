const db = require('../../../config/database');
const FinanceOfficer = require('../../models/FinanceOfficer');
const User = require('../../models/User');
const { ROLES, FEE_TYPES } = require('../../../config/constants');

const financeController = {
  // Finance dashboard
  dashboard: async (req, res) => {
    try {
      const timeframe = req.query.timeframe || 'month';
      
      const [financialOverview, recentPayments, feeStructures, outstandingSummary] = await Promise.all([
        FinanceOfficer.getFinancialOverview(timeframe),
        db.query(`
          SELECT 
            p.*,
            u.name as student_name,
            u.student_id,
            fs.name as fee_name,
            fs.fee_type
          FROM payments p
          JOIN users u ON p.student_id = u.id
          LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
          ORDER BY p.created_at DESC
          LIMIT 10
        `),
        FinanceOfficer.getFeeStructures({ is_active: 1 }, 1, 5),
        db.query(`
          SELECT 
            COUNT(DISTINCT u.id) as students_with_balance,
            SUM(fs.amount) as total_fees_due,
            COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_collected,
            (SUM(fs.amount) - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)) as total_outstanding
          FROM users u
          CROSS JOIN fee_structures fs
          LEFT JOIN payments p ON u.id = p.student_id AND p.fee_structure_id = fs.id
          WHERE u.role_id = (SELECT id FROM roles WHERE name = 'student')
            AND u.is_active = 1
            AND fs.is_active = 1
        `)
      ]);

      res.render('finance/dashboard', {
        title: 'Finance Dashboard - EduLMS',
        layout: 'layouts/finance-layout',
        financialOverview,
        recentPayments,
        feeStructures: feeStructures.feeStructures,
        outstandingSummary: outstandingSummary[0] || {},
        timeframe,
        currentPage: 'dashboard'
      });
    } catch (error) {
      console.error('Finance dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.render('finance/dashboard', {
        title: 'Finance Dashboard - EduLMS',
        layout: 'layouts/finance-layout',
        financialOverview: {},
        recentPayments: [],
        feeStructures: [],
        outstandingSummary: {},
        timeframe: 'month',
        currentPage: 'dashboard'
      });
    }
  },

  // Payment records
  paymentRecords: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status || '';
      const payment_method = req.query.payment_method || '';
      const fee_type = req.query.fee_type || '';
      const start_date = req.query.start_date || '';
      const end_date = req.query.end_date || '';
      const search = req.query.search || '';

      let query = `
        SELECT 
          p.*,
          u.name as student_name,
          u.student_id,
          u.email as student_email,
          fs.name as fee_name,
          fs.fee_type,
          verifier.name as verified_by_name,
          CASE 
            WHEN p.status = 'completed' THEN 'success'
            WHEN p.status = 'pending' THEN 'warning'
            WHEN p.status = 'failed' THEN 'danger'
            ELSE 'secondary'
          END as status_class
        FROM payments p
        JOIN users u ON p.student_id = u.id
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        LEFT JOIN users verifier ON p.verified_by = verifier.id
      `;

      let countQuery = `SELECT COUNT(*) as total FROM payments p JOIN users u ON p.student_id = u.id`;
      const params = [];
      const whereConditions = [];

      // Apply filters
      if (status) {
        whereConditions.push('p.status = ?');
        params.push(status);
      }

      if (payment_method) {
        whereConditions.push('p.payment_method = ?');
        params.push(payment_method);
      }

      if (fee_type) {
        whereConditions.push('fs.fee_type = ?');
        params.push(fee_type);
      }

      if (start_date) {
        whereConditions.push('DATE(p.created_at) >= ?');
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(p.created_at) <= ?');
        params.push(end_date);
      }

      if (search) {
        whereConditions.push('(u.name LIKE ? OR u.student_id LIKE ? OR u.email LIKE ? OR p.mpesa_receipt_number LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      // Build WHERE clause
      if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, (page - 1) * limit);

      const [payments, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2))
      ]);

      // Get payment summary
      const summary = await db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount
        FROM payments
        ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
        GROUP BY status
      `, params.slice(0, -2));

      res.render('finance/payments/records', {
        title: 'Payment Records - EduLMS',
        layout: 'layouts/finance-layout',
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(countResult[0].total / limit),
          total: countResult[0].total
        },
        filters: { status, payment_method, fee_type, start_date, end_date, search },
        summary,
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Payment records error:', error);
      req.flash('error_msg', 'Error loading payment records');
      res.render('finance/payments/records', {
        title: 'Payment Records - EduLMS',
        layout: 'layouts/finance-layout',
        payments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        summary: [],
        currentPage: 'payments'
      });
    }
  },

  // Pending payments
  pendingPayments: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const [payments, countResult] = await Promise.all([
        db.query(`
          SELECT 
            p.*,
            u.name as student_name,
            u.student_id,
            u.email as student_email,
            fs.name as fee_name,
            fs.fee_type,
            TIMESTAMPDIFF(HOUR, p.created_at, NOW()) as hours_pending
          FROM payments p
          JOIN users u ON p.student_id = u.id
          LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
          WHERE p.status = 'pending'
          ORDER BY p.created_at ASC
          LIMIT ? OFFSET ?
        `, [limit, (page - 1) * limit]),
        
        db.query(`SELECT COUNT(*) as total FROM payments WHERE status = 'pending'`)
      ]);

      res.render('finance/payments/pending', {
        title: 'Pending Payments - EduLMS',
        layout: 'layouts/finance-layout',
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(countResult[0].total / limit),
          total: countResult[0].total
        },
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Pending payments error:', error);
      req.flash('error_msg', 'Error loading pending payments');
      res.render('finance/payments/pending', {
        title: 'Pending Payments - EduLMS',
        layout: 'layouts/finance-layout',
        payments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        currentPage: 'payments'
      });
    }
  },

  // Verified payments
  verifiedPayments: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const start_date = req.query.start_date || '';
      const end_date = req.query.end_date || '';

      let query = `
        SELECT 
          p.*,
          u.name as student_name,
          u.student_id,
          fs.name as fee_name,
          fs.fee_type,
          verifier.name as verified_by_name,
          TIMESTAMPDIFF(HOUR, p.created_at, p.verified_at) as verification_time_hours
        FROM payments p
        JOIN users u ON p.student_id = u.id
        LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
        LEFT JOIN users verifier ON p.verified_by = verifier.id
        WHERE p.status = 'completed'
      `;

      let countQuery = `SELECT COUNT(*) as total FROM payments WHERE status = 'completed'`;
      const params = [];
      const whereConditions = [];

      if (start_date) {
        whereConditions.push('DATE(p.verified_at) >= ?');
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(p.verified_at) <= ?');
        params.push(end_date);
      }

      if (whereConditions.length > 0) {
        const whereClause = ' AND ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ` ORDER BY p.verified_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, (page - 1) * limit);

      const [payments, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2))
      ]);

      res.render('finance/payments/verified', {
        title: 'Verified Payments - EduLMS',
        layout: 'layouts/finance-layout',
        payments,
        pagination: {
          current: page,
          pages: Math.ceil(countResult[0].total / limit),
          total: countResult[0].total
        },
        filters: { start_date, end_date },
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Verified payments error:', error);
      req.flash('error_msg', 'Error loading verified payments');
      res.render('finance/payments/verified', {
        title: 'Verified Payments - EduLMS',
        layout: 'layouts/finance-layout',
        payments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        currentPage: 'payments'
      });
    }
  },

  // Verify payment
  verifyPayment: async (req, res) => {
    try {
      const financeOfficerId = req.user.id;
      const paymentId = req.params.id;
      const { status, notes } = req.body;

      const result = await FinanceOfficer.verifyPayment(paymentId, financeOfficerId, status, notes);

      req.flash('success_msg', `Payment ${status} successfully`);
      res.redirect('/finance/payments/pending');

    } catch (error) {
      console.error('Verify payment error:', error);
      req.flash('error_msg', error.message || 'Error verifying payment');
      res.redirect('/finance/payments/pending');
    }
  },

  // Bulk verify payments
  bulkVerifyPayments: async (req, res) => {
    try {
      const financeOfficerId = req.user.id;
      const { payment_ids, status, notes } = req.body;

      if (!payment_ids || !Array.isArray(payment_ids)) {
        req.flash('error_msg', 'No payments selected');
        return res.redirect('/finance/payments/pending');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const paymentId of payment_ids) {
        try {
          await FinanceOfficer.verifyPayment(paymentId, financeOfficerId, status, notes);
          successCount++;
        } catch (error) {
          console.error(`Error verifying payment ${paymentId}:`, error);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        req.flash('warning_msg', `${successCount} payments verified, ${errorCount} failed`);
      } else {
        req.flash('success_msg', `${successCount} payments verified successfully`);
      }

      res.redirect('/finance/payments/pending');

    } catch (error) {
      console.error('Bulk verify payments error:', error);
      req.flash('error_msg', 'Error processing bulk verification');
      res.redirect('/finance/payments/pending');
    }
  },

  // Fee structures management
  feeStructures: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const fee_type = req.query.fee_type || '';
      const academic_year = req.query.academic_year || '';
      const semester = req.query.semester || '';
      const is_active = req.query.is_active !== undefined ? parseInt(req.query.is_active) : undefined;
      const search = req.query.search || '';

      const filters = {};
      if (fee_type) filters.fee_type = fee_type;
      if (academic_year) filters.academic_year = academic_year;
      if (semester) filters.semester = semester;
      if (is_active !== undefined) filters.is_active = is_active;
      if (search) filters.search = search;

      const feeStructuresData = await FinanceOfficer.getFeeStructures(filters, page, limit);

      // Get unique academic years and semesters for filters
      const [academicYears, semesters] = await Promise.all([
        db.query(`SELECT DISTINCT academic_year FROM fee_structures WHERE academic_year IS NOT NULL ORDER BY academic_year DESC`),
        db.query(`SELECT DISTINCT semester FROM fee_structures WHERE semester IS NOT NULL ORDER BY semester`)
      ]);

      res.render('finance/fees/structure', {
        title: 'Fee Structures - EduLMS',
        layout: 'layouts/finance-layout',
        feeStructures: feeStructuresData.feeStructures,
        pagination: {
          current: page,
          pages: feeStructuresData.totalPages,
          total: feeStructuresData.total
        },
        filters,
        feeTypes: Object.values(FEE_TYPES),
        academicYears: academicYears.map(row => row.academic_year),
        semesters: semesters.map(row => row.semester),
        currentPage: 'fees'
      });
    } catch (error) {
      console.error('Fee structures error:', error);
      req.flash('error_msg', 'Error loading fee structures');
      res.render('finance/fees/structure', {
        title: 'Fee Structures - EduLMS',
        layout: 'layouts/finance-layout',
        feeStructures: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        feeTypes: Object.values(FEE_TYPES),
        academicYears: [],
        semesters: [],
        currentPage: 'fees'
      });
    }
  },

  // Show create fee structure form
  showCreateFee: (req, res) => {
    res.render('finance/fees/create', {
      title: 'Create Fee Structure - EduLMS',
      layout: 'layouts/finance-layout',
      feeTypes: Object.values(FEE_TYPES),
      semesters: ['spring', 'summer', 'fall', 'winter'],
      currentYear: new Date().getFullYear(),
      currentPage: 'fees'
    });
  },

  // Create new fee structure
  createFee: async (req, res) => {
    try {
      const financeOfficerId = req.user.id;
      const {
        name,
        description,
        amount,
        fee_type,
        academic_year,
        semester,
        due_date
      } = req.body;

      // Validation
      const errors = [];

      if (!name || !amount || !fee_type) {
        errors.push({ msg: 'Please fill in all required fields' });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        errors.push({ msg: 'Amount must be a positive number' });
      }

      if (!Object.values(FEE_TYPES).includes(fee_type)) {
        errors.push({ msg: 'Invalid fee type' });
      }

      if (errors.length > 0) {
        return res.render('finance/fees/create', {
          title: 'Create Fee Structure - EduLMS',
          layout: 'layouts/finance-layout',
          errors,
          formData: req.body,
          feeTypes: Object.values(FEE_TYPES),
          semesters: ['spring', 'summer', 'fall', 'winter'],
          currentYear: new Date().getFullYear(),
          currentPage: 'fees'
        });
      }

      const feeData = {
        name,
        description: description || null,
        amount: parseFloat(amount),
        fee_type,
        academic_year: academic_year ? parseInt(academic_year) : null,
        semester: semester || null,
        due_date: due_date || null,
        created_by: financeOfficerId
      };

      const feeId = await FinanceOfficer.createFeeStructure(feeData);

      req.flash('success_msg', 'Fee structure created successfully');
      res.redirect('/finance/fees');

    } catch (error) {
      console.error('Create fee error:', error);
      req.flash('error_msg', 'Error creating fee structure');
      res.redirect('/finance/fees/create');
    }
  },

  // Show edit fee structure form
  showEditFee: async (req, res) => {
    try {
      const feeId = req.params.id;

      const feeStructures = await FinanceOfficer.getFeeStructures({}, 1, 1);
      const feeStructure = feeStructures.feeStructures.find(fee => fee.id == feeId);

      if (!feeStructure) {
        req.flash('error_msg', 'Fee structure not found');
        return res.redirect('/finance/fees');
      }

      res.render('finance/fees/edit', {
        title: 'Edit Fee Structure - EduLMS',
        layout: 'layouts/finance-layout',
        feeStructure,
        feeTypes: Object.values(FEE_TYPES),
        semesters: ['spring', 'summer', 'fall', 'winter'],
        currentPage: 'fees'
      });
    } catch (error) {
      console.error('Show edit fee error:', error);
      req.flash('error_msg', 'Error loading fee structure');
      res.redirect('/finance/fees');
    }
  },

  // Update fee structure
  updateFee: async (req, res) => {
    try {
      const feeId = req.params.id;
      const {
        name,
        description,
        amount,
        fee_type,
        academic_year,
        semester,
        due_date,
        is_active
      } = req.body;

      const updateData = {
        name,
        description: description || null,
        amount: parseFloat(amount),
        fee_type,
        academic_year: academic_year ? parseInt(academic_year) : null,
        semester: semester || null,
        due_date: due_date || null,
        is_active: is_active === '1'
      };

      await FinanceOfficer.updateFeeStructure(feeId, updateData);

      req.flash('success_msg', 'Fee structure updated successfully');
      res.redirect('/finance/fees');

    } catch (error) {
      console.error('Update fee error:', error);
      req.flash('error_msg', error.message || 'Error updating fee structure');
      res.redirect(`/finance/fees/edit/${feeId}`);
    }
  },

  // Delete fee structure
  deleteFee: async (req, res) => {
    try {
      const feeId = req.params.id;

      await FinanceOfficer.deleteFeeStructure(feeId);

      req.flash('success_msg', 'Fee structure deleted successfully');
      res.redirect('/finance/fees');

    } catch (error) {
      console.error('Delete fee error:', error);
      req.flash('error_msg', error.message || 'Error deleting fee structure');
      res.redirect('/finance/fees');
    }
  },

  // Student fee statements
  studentFeeStatements: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const outstanding_only = req.query.outstanding_only === '1';
      const search = req.query.search || '';

      const filters = {};
      if (outstanding_only) filters.outstanding_only = true;
      if (search) filters.student_search = search;

      const statementsData = await FinanceOfficer.getStudentFeeStatements(filters, page, limit);

      res.render('finance/students/fee-statements', {
        title: 'Student Fee Statements - EduLMS',
        layout: 'layouts/finance-layout',
        statements: statementsData.statements,
        pagination: {
          current: page,
          pages: statementsData.totalPages,
          total: statementsData.total
        },
        filters: { outstanding_only, search },
        currentPage: 'students'
      });
    } catch (error) {
      console.error('Student fee statements error:', error);
      req.flash('error_msg', 'Error loading student fee statements');
      res.render('finance/students/fee-statements', {
        title: 'Student Fee Statements - EduLMS',
        layout: 'layouts/finance-layout',
        statements: [],
        pagination: { current: 1, pages: 0, total: 0 },
        filters: {},
        currentPage: 'students'
      });
    }
  },

  // View student payment history
  viewStudentPayments: async (req, res) => {
    try {
      const studentId = req.params.id;

      const paymentHistory = await FinanceOfficer.getStudentPaymentHistory(studentId);

      res.render('finance/students/payment-history', {
        title: `Payment History - ${paymentHistory.student.name}`,
        layout: 'layouts/finance-layout',
        ...paymentHistory,
        currentPage: 'students'
      });
    } catch (error) {
      console.error('View student payments error:', error);
      req.flash('error_msg', 'Error loading student payment history');
      res.redirect('/finance/students/fee-statements');
    }
  },

  // Outstanding fees
  outstandingFees: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const department = req.query.department || '';
      const min_balance = req.query.min_balance || '';

      const filters = {};
      if (department) filters.department = department;
      if (min_balance) filters.min_balance = parseFloat(min_balance);

      const outstandingData = await FinanceOfficer.generateOutstandingFeesReport(filters);

      // Get unique departments for filter
      const departments = await db.query(`
        SELECT DISTINCT c.department 
        FROM courses c 
        WHERE c.department IS NOT NULL 
        ORDER BY c.department
      `);

      res.render('finance/students/outstanding', {
        title: 'Outstanding Fees - EduLMS',
        layout: 'layouts/finance-layout',
        outstandingFees: outstandingData.outstandingFees,
        summary: outstandingData.summary,
        filters,
        departments: departments.map(row => row.department),
        currentPage: 'students'
      });
    } catch (error) {
      console.error('Outstanding fees error:', error);
      req.flash('error_msg', 'Error loading outstanding fees');
      res.render('finance/students/outstanding', {
        title: 'Outstanding Fees - EduLMS',
        layout: 'layouts/finance-layout',
        outstandingFees: [],
        summary: {},
        filters: {},
        departments: [],
        currentPage: 'students'
      });
    }
  },

  // Generate financial reports
  generateReport: async (req, res) => {
    try {
      const { report_type, format, start_date, end_date, fee_type, department, academic_year, semester } = req.query;

      if (!report_type) {
        return res.render('finance/reports/generate', {
          title: 'Generate Reports - EduLMS',
          layout: 'layouts/finance-layout',
          currentPage: 'reports'
        });
      }

      const filters = {};
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (fee_type) filters.fee_type = fee_type;
      if (department) filters.department = department;
      if (academic_year) filters.academic_year = academic_year;
      if (semester) filters.semester = semester;

      const reportData = await FinanceOfficer.generateFinancialReport(report_type, filters);

      if (format === 'pdf') {
        // In a real application, generate PDF using PDFKit
        // For now, we'll return JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${report_type}-report-${new Date().toISOString().split('T')[0]}.json`);
        return res.json(reportData);
      } else if (format === 'csv') {
        // Generate CSV format
        // This is a simplified version - in real app, you'd properly format the data
        const csvData = Object.keys(reportData).map(key => `${key},${reportData[key]}`).join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${report_type}-report-${new Date().toISOString().split('T')[0]}.csv`);
        return res.send(csvData);
      } else {
        // Display in browser
        res.render('finance/reports/view', {
          title: `${report_type.replace('_', ' ').toUpperCase()} Report - EduLMS`,
          layout: 'layouts/finance-layout',
          reportData,
          reportType: report_type,
          filters,
          currentPage: 'reports'
        });
      }

    } catch (error) {
      console.error('Generate report error:', error);
      req.flash('error_msg', 'Error generating report');
      res.redirect('/finance/reports');
    }
  },

  // Show report generation form
  showReports: (req, res) => {
    res.render('finance/reports/generate', {
      title: 'Generate Reports - EduLMS',
      layout: 'layouts/finance-layout',
      reportTypes: [
        { value: 'revenue_summary', label: 'Revenue Summary' },
        { value: 'fee_collection', label: 'Fee Collection' },
        { value: 'outstanding_fees', label: 'Outstanding Fees' },
        { value: 'payment_methods', label: 'Payment Methods' }
      ],
      feeTypes: Object.values(FEE_TYPES),
      currentPage: 'reports'
    });
  },

  // Payment reconciliation
  paymentReconciliation: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      // Get payments that need reconciliation (MPesa payments without receipt numbers)
      const [unreconciledPayments, countResult] = await Promise.all([
        db.query(`
          SELECT 
            p.*,
            u.name as student_name,
            u.student_id,
            fs.name as fee_name,
            TIMESTAMPDIFF(HOUR, p.created_at, NOW()) as hours_pending
          FROM payments p
          JOIN users u ON p.student_id = u.id
          LEFT JOIN fee_structures fs ON p.fee_structure_id = fs.id
          WHERE p.payment_method = 'mpesa' 
            AND p.status = 'pending'
            AND p.mpesa_receipt_number IS NULL
            AND p.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
          ORDER BY p.created_at DESC
          LIMIT ? OFFSET ?
        `, [limit, (page - 1) * limit]),
        
        db.query(`
          SELECT COUNT(*) as total 
          FROM payments 
          WHERE payment_method = 'mpesa' 
            AND status = 'pending'
            AND mpesa_receipt_number IS NULL
            AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `)
      ]);

      res.render('finance/payments/reconciliation', {
        title: 'Payment Reconciliation - EduLMS',
        layout: 'layouts/finance-layout',
        payments: unreconciledPayments,
        pagination: {
          current: page,
          pages: Math.ceil(countResult[0].total / limit),
          total: countResult[0].total
        },
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Payment reconciliation error:', error);
      req.flash('error_msg', 'Error loading payment reconciliation');
      res.render('finance/payments/reconciliation', {
        title: 'Payment Reconciliation - EduLMS',
        layout: 'layouts/finance-layout',
        payments: [],
        pagination: { current: 1, pages: 0, total: 0 },
        currentPage: 'payments'
      });
    }
  },

  // Manual payment entry
  showManualPayment: async (req, res) => {
    try {
      const studentId = req.query.student_id || '';

      const [feeStructures, students] = await Promise.all([
        db.query('SELECT * FROM fee_structures WHERE is_active = 1 ORDER BY fee_type, name'),
        studentId ? db.query('SELECT id, name, student_id FROM users WHERE id = ? AND role_id = (SELECT id FROM roles WHERE name = "student")', [studentId]) : []
      ]);

      res.render('finance/payments/manual-entry', {
        title: 'Manual Payment Entry - EduLMS',
        layout: 'layouts/finance-layout',
        feeStructures,
        student: students[0] || null,
        paymentMethods: ['cash', 'bank_transfer', 'card'],
        currentPage: 'payments'
      });
    } catch (error) {
      console.error('Show manual payment error:', error);
      req.flash('error_msg', 'Error loading manual payment form');
      res.redirect('/finance/payments');
    }
  },

  // Process manual payment
  processManualPayment: async (req, res) => {
    try {
      const financeOfficerId = req.user.id;
      const { student_id, fee_structure_id, amount, payment_method, receipt_number, notes } = req.body;

      // Validation
      const errors = [];

      if (!student_id || !fee_structure_id || !amount || !payment_method) {
        errors.push({ msg: 'Please fill in all required fields' });
      }

      if (isNaN(amount) || parseFloat(amount) <= 0) {
        errors.push({ msg: 'Amount must be a positive number' });
      }

      if (errors.length > 0) {
        const feeStructures = await db.query('SELECT * FROM fee_structures WHERE is_active = 1 ORDER BY fee_type, name');
        
        return res.render('finance/payments/manual-entry', {
          title: 'Manual Payment Entry - EduLMS',
          layout: 'layouts/finance-layout',
          errors,
          formData: req.body,
          feeStructures,
          paymentMethods: ['cash', 'bank_transfer', 'card'],
          currentPage: 'payments'
        });
      }

      // Create payment record
      const result = await db.query(`
        INSERT INTO payments (student_id, fee_structure_id, amount, payment_method, status, description, verified_by, verified_at, payment_date)
        VALUES (?, ?, ?, ?, 'completed', ?, ?, NOW(), NOW())
      `, [student_id, fee_structure_id, amount, payment_method, notes || 'Manual entry', financeOfficerId]);

      // Log the manual payment
      await db.query(`
        INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
        VALUES (?, 'manual_payment_entry', 'payments', ?, ?)
      `, [financeOfficerId, result.insertId, JSON.stringify(req.body)]);

      req.flash('success_msg', 'Manual payment recorded successfully');
      res.redirect('/finance/payments/records');

    } catch (error) {
      console.error('Process manual payment error:', error);
      req.flash('error_msg', 'Error recording manual payment');
      res.redirect('/finance/payments/manual-entry');
    }
  },

  // View finance profile
  profile: async (req, res) => {
    try {
      const financeOfficerId = req.user.id;
      const user = await User.findById(financeOfficerId);

      // Get finance officer statistics
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total_payments_processed,
          SUM(amount) as total_amount_processed,
          COUNT(CASE WHEN verified_by = ? THEN 1 END) as payments_verified_by_me
        FROM payments 
        WHERE status = 'completed'
      `, [financeOfficerId]);

      res.render('finance/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/finance-layout',
        user,
        stats: stats[0] || {},
        currentPage: 'profile'
      });
    } catch (error) {
      console.error('Finance profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.render('finance/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/finance-layout',
        user: {},
        stats: {},
        currentPage: 'profile'
      });
    }
  }
};

module.exports = financeController;