const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../../config/database');
const { Generators, Helpers, Formatters } = require('../utils');

class ReportService {
  constructor() {
    this.reportTypes = {
      ACADEMIC: 'academic',
      FINANCIAL: 'financial',
      ATTENDANCE: 'attendance',
      PERFORMANCE: 'performance',
      STUDENT: 'student',
      INSTRUCTOR: 'instructor',
      COURSE: 'course',
      PAYMENT: 'payment',
      CUSTOM: 'custom'
    };

    this.exportFormats = {
      PDF: 'pdf',
      EXCEL: 'excel',
      CSV: 'csv',
      JSON: 'json'
    };
  }

  /**
   * Generate academic performance report
   */
  async generateAcademicReport(options = {}) {
    try {
      const {
        courseId = null,
        instructorId = null,
        studentId = null,
        academicYear = Helpers.getAcademicYear(),
        semester = Helpers.getSemesterFromDate(),
        format = this.exportFormats.PDF,
        includeDetails = true
      } = options;

      let query = `
        SELECT 
          c.code as course_code,
          c.title as course_title,
          c.credits,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name,
          s.student_id,
          s2.first_name as student_first_name,
          s2.last_name as student_last_name,
          g.score,
          g.grade,
          g.feedback,
          a.title as assignment_title,
          a.total_points as assignment_total_points,
          g.created_at as graded_date
        FROM grades g
        JOIN assignments a ON g.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        JOIN users s2 ON g.student_id = s2.id
        LEFT JOIN students s ON g.student_id = s.user_id
        WHERE 1=1
      `;

      const params = [];

      if (courseId) {
        query += ' AND c.id = ?';
        params.push(courseId);
      }

      if (instructorId) {
        query += ' AND c.instructor_id = ?';
        params.push(instructorId);
      }

      if (studentId) {
        query += ' AND g.student_id = ?';
        params.push(studentId);
      }

      query += ' ORDER BY c.code, s2.last_name, s2.first_name';

      const grades = await db.query(query, params);

      // Calculate statistics
      const statistics = this.calculateAcademicStatistics(grades);

      const reportData = {
        title: 'Academic Performance Report',
        generatedAt: new Date(),
        filters: {
          courseId,
          instructorId,
          studentId,
          academicYear,
          semester
        },
        grades,
        statistics,
        includeDetails
      };

      // Generate report in requested format
      switch (format) {
        case this.exportFormats.PDF:
          return await this.generateAcademicPDF(reportData);
        case this.exportFormats.EXCEL:
          return await this.generateAcademicExcel(reportData);
        case this.exportFormats.CSV:
          return await this.generateAcademicCSV(reportData);
        case this.exportFormats.JSON:
          return await this.generateAcademicJSON(reportData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('❌ Academic report generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(options = {}) {
    try {
      const {
        startDate = new Date(new Date().getFullYear(), 0, 1), // Start of year
        endDate = new Date(),
        feeType = null,
        status = 'completed',
        program = null,
        format = this.exportFormats.PDF,
        groupBy = 'month'
      } = options;

      let query = `
        SELECT 
          p.*,
          s.student_id,
          u.first_name,
          u.last_name,
          u.email,
          s.program,
          s.semester,
          s.year,
          f.name as fee_name,
          f.fee_type
        FROM payments p
        JOIN users u ON p.student_id = u.id
        LEFT JOIN students s ON p.student_id = s.user_id
        LEFT JOIN fee_structures f ON p.fee_structure_id = f.id
        WHERE p.created_at BETWEEN ? AND ?
      `;

      const params = [startDate, endDate];

      if (feeType) {
        query += ' AND f.fee_type = ?';
        params.push(feeType);
      }

      if (status) {
        query += ' AND p.status = ?';
        params.push(status);
      }

      if (program) {
        query += ' AND s.program = ?';
        params.push(program);
      }

      query += ' ORDER BY p.created_at DESC';

      const payments = await db.query(query, params);

      // Calculate financial statistics
      const statistics = this.calculateFinancialStatistics(payments, startDate, endDate, groupBy);

      const reportData = {
        title: 'Financial Report',
        generatedAt: new Date(),
        filters: {
          startDate,
          endDate,
          feeType,
          status,
          program,
          groupBy
        },
        payments,
        statistics,
        summary: {
          totalRevenue: statistics.totalRevenue,
          totalPayments: statistics.totalPayments,
          averagePayment: statistics.averagePayment
        }
      };

      // Generate report in requested format
      switch (format) {
        case this.exportFormats.PDF:
          return await this.generateFinancialPDF(reportData);
        case this.exportFormats.EXCEL:
          return await this.generateFinancialExcel(reportData);
        case this.exportFormats.CSV:
          return await this.generateFinancialCSV(reportData);
        case this.exportFormats.JSON:
          return await this.generateFinancialJSON(reportData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('❌ Financial report generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate student progress report
   */
  async generateStudentProgressReport(studentId, options = {}) {
    try {
      const {
        academicYear = Helpers.getAcademicYear(),
        semester = Helpers.getSemesterFromDate(),
        format = this.exportFormats.PDF,
        includeAllCourses = false
      } = options;

      // Get student information
      const student = await db.query(`
        SELECT s.*, u.first_name, u.last_name, u.email, u.phone
        FROM students s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = ?
      `, [studentId]);

      if (student.length === 0) {
        throw new Error('Student not found');
      }

      // Get student enrollments and grades
      const enrollments = await db.query(`
        SELECT 
          e.*,
          c.code as course_code,
          c.title as course_title,
          c.credits,
          u.first_name as instructor_first_name,
          u.last_name as instructor_last_name
        FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        WHERE e.student_id = ?
        ORDER BY e.enrollment_date DESC
      `, [studentId]);

      // Get grades for each course
      const courseGrades = [];
      for (const enrollment of enrollments) {
        const grades = await db.query(`
          SELECT 
            g.*,
            a.title as assignment_title,
            a.total_points,
            a.due_date
          FROM grades g
          JOIN assignments a ON g.assignment_id = a.id
          WHERE g.student_id = ? AND a.course_id = ?
          ORDER BY a.due_date
        `, [studentId, enrollment.course_id]);

        const courseGPA = Helpers.calculateGPA(grades);
        const completedAssignments = grades.filter(g => g.score !== null).length;
        const totalAssignments = grades.length;

        courseGrades.push({
          course: enrollment,
          grades,
          statistics: {
            gpa: courseGPA,
            completedAssignments,
            totalAssignments,
            completionRate: totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0
          }
        });
      }

      // Calculate overall statistics
      const overallGPA = Helpers.calculateGPA(courseGrades.flatMap(cg => cg.grades));
      const totalCredits = enrollments.reduce((sum, e) => sum + e.credits, 0);
      const completedCourses = enrollments.filter(e => e.status === 'completed').length;

      const reportData = {
        title: 'Student Progress Report',
        generatedAt: new Date(),
        student: student[0],
        courseGrades,
        overallStatistics: {
          gpa: overallGPA,
          totalCredits,
          completedCourses,
          totalEnrollments: enrollments.length
        },
        filters: {
          academicYear,
          semester,
          includeAllCourses
        }
      };

      // Generate report in requested format
      switch (format) {
        case this.exportFormats.PDF:
          return await this.generateStudentProgressPDF(reportData);
        case this.exportFormats.EXCEL:
          return await this.generateStudentProgressExcel(reportData);
        case this.exportFormats.CSV:
          return await this.generateStudentProgressCSV(reportData);
        case this.exportFormats.JSON:
          return await this.generateStudentProgressJSON(reportData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('❌ Student progress report generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate attendance report
   */
  async generateAttendanceReport(options = {}) {
    try {
      const {
        courseId = null,
        instructorId = null,
        startDate = new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
        endDate = new Date(),
        format = this.exportFormats.PDF
      } = options;

      let query = `
        SELECT 
          a.*,
          c.code as course_code,
          c.title as course_title,
          u.first_name as student_first_name,
          u.last_name as student_last_name,
          s.student_id,
          i.first_name as instructor_first_name,
          i.last_name as instructor_last_name
        FROM attendance a
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON a.student_id = u.id
        JOIN users i ON c.instructor_id = i.id
        LEFT JOIN students s ON a.student_id = s.user_id
        WHERE a.attendance_date BETWEEN ? AND ?
      `;

      const params = [startDate, endDate];

      if (courseId) {
        query += ' AND a.course_id = ?';
        params.push(courseId);
      }

      if (instructorId) {
        query += ' AND c.instructor_id = ?';
        params.push(instructorId);
      }

      query += ' ORDER BY a.attendance_date DESC, c.code, u.last_name, u.first_name';

      const attendance = await db.query(query, params);

      // Calculate attendance statistics
      const statistics = this.calculateAttendanceStatistics(attendance);

      const reportData = {
        title: 'Attendance Report',
        generatedAt: new Date(),
        filters: {
          courseId,
          instructorId,
          startDate,
          endDate
        },
        attendance,
        statistics
      };

      // Generate report in requested format
      switch (format) {
        case this.exportFormats.PDF:
          return await this.generateAttendancePDF(reportData);
        case this.exportFormats.EXCEL:
          return await this.generateAttendanceExcel(reportData);
        case this.exportFormats.CSV:
          return await this.generateAttendanceCSV(reportData);
        case this.exportFormats.JSON:
          return await this.generateAttendanceJSON(reportData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('❌ Attendance report generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate custom report based on SQL query
   */
  async generateCustomReport(sqlQuery, params = [], options = {}) {
    try {
      const {
        format = this.exportFormats.EXCEL,
        reportName = 'Custom Report',
        includeHeaders = true
      } = options;

      // Validate SQL query (basic safety check)
      if (!this.isSafeQuery(sqlQuery)) {
        throw new Error('Potentially unsafe SQL query detected');
      }

      const results = await db.query(sqlQuery, params);

      const reportData = {
        title: reportName,
        generatedAt: new Date(),
        query: sqlQuery,
        parameters: params,
        results,
        includeHeaders
      };

      // Generate report in requested format
      switch (format) {
        case this.exportFormats.PDF:
          return await this.generateCustomPDF(reportData);
        case this.exportFormats.EXCEL:
          return await this.generateCustomExcel(reportData);
        case this.exportFormats.CSV:
          return await this.generateCustomCSV(reportData);
        case this.exportFormats.JSON:
          return await this.generateCustomJSON(reportData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

    } catch (error) {
      console.error('❌ Custom report generation failed:', error);
      throw error;
    }
  }

  // PDF Generation Methods

  async generateAcademicPDF(reportData) {
    const pdfService = require('./pdfService');
    return await pdfService.generateAcademicReport(reportData);
  }

  async generateFinancialPDF(reportData) {
    const pdfService = require('./pdfService');
    return await pdfService.generateFinancialReport(reportData);
  }

  async generateStudentProgressPDF(reportData) {
    const pdfService = require('./pdfService');
    return await pdfService.generateStudentProgressReport(reportData);
  }

  async generateAttendancePDF(reportData) {
    // Similar implementation to other PDF methods
    return this.generateBasicPDF(reportData);
  }

  async generateCustomPDF(reportData) {
    return this.generateBasicPDF(reportData);
  }

  // Excel Generation Methods

  async generateAcademicExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Academic Report');

    // Add headers
    worksheet.columns = [
      { header: 'Course Code', key: 'course_code', width: 15 },
      { header: 'Course Title', key: 'course_title', width: 30 },
      { header: 'Student ID', key: 'student_id', width: 15 },
      { header: 'Student Name', key: 'student_name', width: 25 },
      { header: 'Assignment', key: 'assignment_title', width: 30 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Total Points', key: 'total_points', width: 12 },
      { header: 'Grade', key: 'grade', width: 8 },
      { header: 'Instructor', key: 'instructor', width: 25 },
      { header: 'Graded Date', key: 'graded_date', width: 15 }
    ];

    // Add data
    reportData.grades.forEach(grade => {
      worksheet.addRow({
        course_code: grade.course_code,
        course_title: grade.course_title,
        student_id: grade.student_id,
        student_name: `${grade.student_first_name} ${grade.student_last_name}`,
        assignment_title: grade.assignment_title,
        score: grade.score,
        total_points: grade.assignment_total_points,
        grade: grade.grade,
        instructor: `${grade.instructor_first_name} ${grade.instructor_last_name}`,
        graded_date: Helpers.formatDate(grade.graded_date)
      });
    });

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addExcelSummary(summarySheet, reportData);

    return await workbook.xlsx.writeBuffer();
  }

  async generateFinancialExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Financial Report');

    // Add headers
    worksheet.columns = [
      { header: 'Payment ID', key: 'id', width: 12 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Student ID', key: 'student_id', width: 15 },
      { header: 'Student Name', key: 'student_name', width: 25 },
      { header: 'Program', key: 'program', width: 20 },
      { header: 'Fee Type', key: 'fee_type', width: 15 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Receipt', key: 'receipt', width: 15 },
      { header: 'Payment Method', key: 'payment_method', width: 15 }
    ];

    // Add data
    reportData.payments.forEach(payment => {
      worksheet.addRow({
        id: payment.id,
        date: Helpers.formatDate(payment.created_at),
        student_id: payment.student_id,
        student_name: `${payment.first_name} ${payment.last_name}`,
        program: payment.program,
        fee_type: payment.fee_type,
        amount: payment.amount,
        status: payment.status,
        receipt: payment.mpesa_receipt || 'N/A',
        payment_method: payment.payment_method
      });
    });

    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addFinancialExcelSummary(summarySheet, reportData);

    return await workbook.xlsx.writeBuffer();
  }

  async generateStudentProgressExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Student Progress');

    // Add student info
    worksheet.addRow(['Student Progress Report']);
    worksheet.addRow(['Generated:', Helpers.formatDateTime(reportData.generatedAt)]);
    worksheet.addRow(['Student:', `${reportData.student.first_name} ${reportData.student.last_name}`]);
    worksheet.addRow(['Student ID:', reportData.student.student_id]);
    worksheet.addRow(['Program:', reportData.student.program]);
    worksheet.addRow([]);

    // Add course grades
    worksheet.addRow(['Course Grades']);
    worksheet.addRow(['Course Code', 'Course Title', 'Credits', 'GPA', 'Completed', 'Total', 'Completion Rate']);

    reportData.courseGrades.forEach(cg => {
      worksheet.addRow([
        cg.course.course_code,
        cg.course.course_title,
        cg.course.credits,
        cg.statistics.gpa.toFixed(2),
        cg.statistics.completedAssignments,
        cg.statistics.totalAssignments,
        `${cg.statistics.completionRate.toFixed(1)}%`
      ]);
    });

    worksheet.addRow([]);
    worksheet.addRow(['Overall Statistics']);
    worksheet.addRow(['Overall GPA:', reportData.overallStatistics.gpa.toFixed(2)]);
    worksheet.addRow(['Total Credits:', reportData.overallStatistics.totalCredits]);
    worksheet.addRow(['Completed Courses:', reportData.overallStatistics.completedCourses]);

    return await workbook.xlsx.writeBuffer();
  }

  async generateAttendanceExcel(reportData) {
    // Similar implementation to other Excel methods
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Report');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Course', key: 'course', width: 20 },
      { header: 'Student', key: 'student', width: 25 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Instructor', key: 'instructor', width: 25 }
    ];

    reportData.attendance.forEach(record => {
      worksheet.addRow({
        date: Helpers.formatDate(record.attendance_date),
        course: record.course_code,
        student: `${record.student_first_name} ${record.student_last_name}`,
        status: record.status,
        instructor: `${record.instructor_first_name} ${record.instructor_last_name}`
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  async generateCustomExcel(reportData) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Custom Report');

    if (reportData.results.length > 0) {
      // Add headers from first result
      const headers = Object.keys(reportData.results[0]);
      worksheet.columns = headers.map(header => ({
        header: header.replace(/_/g, ' ').toUpperCase(),
        key: header,
        width: 20
      }));

      // Add data
      reportData.results.forEach(row => {
        worksheet.addRow(row);
      });
    }

    return await workbook.xlsx.writeBuffer();
  }

  // CSV Generation Methods

  async generateAcademicCSV(reportData) {
    const headers = ['Course Code', 'Course Title', 'Student ID', 'Student Name', 'Assignment', 'Score', 'Total Points', 'Grade', 'Instructor', 'Graded Date'];
    const rows = reportData.grades.map(grade => [
      grade.course_code,
      grade.course_title,
      grade.student_id,
      `${grade.student_first_name} ${grade.student_last_name}`,
      grade.assignment_title,
      grade.score,
      grade.assignment_total_points,
      grade.grade,
      `${grade.instructor_first_name} ${grade.instructor_last_name}`,
      Helpers.formatDate(grade.graded_date)
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  async generateFinancialCSV(reportData) {
    const headers = ['Payment ID', 'Date', 'Student ID', 'Student Name', 'Program', 'Fee Type', 'Amount', 'Status', 'Receipt', 'Payment Method'];
    const rows = reportData.payments.map(payment => [
      payment.id,
      Helpers.formatDate(payment.created_at),
      payment.student_id,
      `${payment.first_name} ${payment.last_name}`,
      payment.program,
      payment.fee_type,
      payment.amount,
      payment.status,
      payment.mpesa_receipt || 'N/A',
      payment.payment_method
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  async generateStudentProgressCSV(reportData) {
    const headers = ['Course Code', 'Course Title', 'Credits', 'GPA', 'Completed Assignments', 'Total Assignments', 'Completion Rate'];
    const rows = reportData.courseGrades.map(cg => [
      cg.course.course_code,
      cg.course.course_title,
      cg.course.credits,
      cg.statistics.gpa.toFixed(2),
      cg.statistics.completedAssignments,
      cg.statistics.totalAssignments,
      `${cg.statistics.completionRate.toFixed(1)}%`
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  async generateAttendanceCSV(reportData) {
    const headers = ['Date', 'Course', 'Student', 'Status', 'Instructor'];
    const rows = reportData.attendance.forEach(record => [
      Helpers.formatDate(record.attendance_date),
      record.course_code,
      `${record.student_first_name} ${record.student_last_name}`,
      record.status,
      `${record.instructor_first_name} ${record.instructor_last_name}`
    ]);

    return this.arrayToCSV([headers, ...rows]);
  }

  async generateCustomCSV(reportData) {
    if (reportData.results.length === 0) {
      return '';
    }

    const headers = Object.keys(reportData.results[0]);
    const rows = reportData.results.map(row => headers.map(header => row[header]));

    return this.arrayToCSV([headers, ...rows]);
  }

  // JSON Generation Methods

  async generateAcademicJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  async generateFinancialJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  async generateStudentProgressJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  async generateAttendanceJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  async generateCustomJSON(reportData) {
    return JSON.stringify(reportData, null, 2);
  }

  // Helper Methods

  calculateAcademicStatistics(grades) {
    const totalStudents = new Set(grades.map(g => g.student_id)).size;
    const totalAssignments = new Set(grades.map(g => g.assignment_id)).size;
    const averageScore = grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length;
    
    const gradeDistribution = {};
    grades.forEach(grade => {
      if (grade.grade) {
        gradeDistribution[grade.grade] = (gradeDistribution[grade.grade] || 0) + 1;
      }
    });

    return {
      totalStudents,
      totalAssignments,
      averageScore: averageScore.toFixed(2),
      gradeDistribution
    };
  }

  calculateFinancialStatistics(payments, startDate, endDate, groupBy) {
    const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalPayments = payments.length;
    const averagePayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;

    // Group by time period
    const revenueByPeriod = {};
    payments.forEach(payment => {
      const date = new Date(payment.created_at);
      let periodKey;

      switch (groupBy) {
        case 'day':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          periodKey = 'all';
      }

      if (!revenueByPeriod[periodKey]) {
        revenueByPeriod[periodKey] = {
          period: periodKey,
          revenue: 0,
          count: 0
        };
      }

      revenueByPeriod[periodKey].revenue += parseFloat(payment.amount);
      revenueByPeriod[periodKey].count++;
    });

    return {
      totalRevenue,
      totalPayments,
      averagePayment: averagePayment.toFixed(2),
      revenueByPeriod: Object.values(revenueByPeriod)
    };
  }

  calculateAttendanceStatistics(attendance) {
    const totalRecords = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;

    return {
      totalRecords,
      present,
      absent,
      late,
      attendanceRate: totalRecords > 0 ? (present / totalRecords) * 100 : 0
    };
  }

  arrayToCSV(data) {
    return data.map(row =>
      row.map(field => {
        const stringField = String(field || '');
        return `"${stringField.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\n');
  }

  addExcelSummary(worksheet, reportData) {
    worksheet.addRow(['Report Summary']);
    worksheet.addRow(['Generated:', Helpers.formatDateTime(reportData.generatedAt)]);
    worksheet.addRow(['Total Records:', reportData.grades.length]);
    worksheet.addRow(['Average Score:', reportData.statistics.averageScore]);
    worksheet.addRow(['Total Students:', reportData.statistics.totalStudents]);
  }

  addFinancialExcelSummary(worksheet, reportData) {
    worksheet.addRow(['Financial Summary']);
    worksheet.addRow(['Generated:', Helpers.formatDateTime(reportData.generatedAt)]);
    worksheet.addRow(['Total Revenue:', Helpers.formatCurrency(reportData.summary.totalRevenue)]);
    worksheet.addRow(['Total Payments:', reportData.summary.totalPayments]);
    worksheet.addRow(['Average Payment:', Helpers.formatCurrency(reportData.summary.averagePayment)]);
  }

  isSafeQuery(sqlQuery) {
    // Basic SQL injection prevention
    const dangerousPatterns = [
      /DROP\s+TABLE/i,
      /DELETE\s+FROM/i,
      /UPDATE\s+.+\s+SET/i,
      /INSERT\s+INTO/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i,
      /TRUNCATE\s+TABLE/i,
      /EXEC(\s|\()/i,
      /XP_/i,
      /--/,
      /;/,
      /\/\*.*\*\//
    ];

    return !dangerousPatterns.some(pattern => pattern.test(sqlQuery));
  }

  async generateBasicPDF(reportData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Basic PDF content
        doc.fontSize(16).text(reportData.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${Helpers.formatDateTime(reportData.generatedAt)}`);
        doc.moveDown();

        // Add basic content based on report type
        if (reportData.results) {
          // Custom report with results
          reportData.results.forEach((row, index) => {
            if (index < 100) { // Limit to first 100 rows for PDF
              doc.text(JSON.stringify(row));
              doc.moveDown(0.5);
            }
          });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get available report templates
   */
  async getReportTemplates() {
    return [
      {
        id: 'academic_performance',
        name: 'Academic Performance Report',
        description: 'Detailed report on student academic performance',
        type: this.reportTypes.ACADEMIC,
        formats: [this.exportFormats.PDF, this.exportFormats.EXCEL, this.exportFormats.CSV]
      },
      {
        id: 'financial_summary',
        name: 'Financial Summary Report',
        description: 'Summary of financial transactions and revenue',
        type: this.reportTypes.FINANCIAL,
        formats: [this.exportFormats.PDF, this.exportFormats.EXCEL, this.exportFormats.CSV]
      },
      {
        id: 'student_progress',
        name: 'Student Progress Report',
        description: 'Individual student progress and performance',
        type: this.reportTypes.STUDENT,
        formats: [this.exportFormats.PDF, this.exportFormats.EXCEL]
      },
      {
        id: 'attendance_tracking',
        name: 'Attendance Tracking Report',
        description: 'Student attendance records and statistics',
        type: this.reportTypes.ATTENDANCE,
        formats: [this.exportFormats.PDF, this.exportFormats.EXCEL, this.exportFormats.CSV]
      }
    ];
  }

  /**
   * Schedule automated report generation
   */
  async scheduleReport(reportConfig) {
    try {
      const scheduleId = Generators.generateReportId('SCH');
      
      await db.query(
        `INSERT INTO report_schedules 
         (id, name, type, config, frequency, next_run, is_active, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          reportConfig.name,
          reportConfig.type,
          JSON.stringify(reportConfig.config),
          reportConfig.frequency,
          reportConfig.nextRun,
          reportConfig.isActive !== false,
          reportConfig.createdBy
        ]
      );

      return {
        success: true,
        scheduleId,
        message: 'Report schedule created successfully'
      };
    } catch (error) {
      console.error('❌ Report scheduling failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ReportService();