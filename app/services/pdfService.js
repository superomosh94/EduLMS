const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { Generators, Helpers, Formatters } = require('../utils');

class PDFService {
  constructor() {
    this.fonts = {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
      boldItalic: 'Helvetica-BoldOblique'
    };
  }

  /**
   * Generate student transcript
   */
  async generateTranscript(student, grades, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'ACADEMIC TRANSCRIPT');
        
        // Student information
        this.addStudentInfo(doc, student);
        
        // Academic summary
        this.addAcademicSummary(doc, grades);
        
        // Course grades
        this.addCourseGrades(doc, grades);
        
        // Footer
        this.addFooter(doc, 'Official Transcript');
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoice(invoice, student, items, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with logo
        this.addInvoiceHeader(doc, invoice);
        
        // Student and invoice info
        this.addInvoiceInfo(doc, invoice, student);
        
        // Invoice items
        this.addInvoiceItems(doc, items);
        
        // Totals and payment info
        this.addInvoiceTotals(doc, items);
        
        // Terms and conditions
        this.addInvoiceTerms(doc);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate financial report
   */
  async generateFinancialReport(reportData, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'FINANCIAL REPORT');
        
        // Report summary
        this.addFinancialSummary(doc, reportData);
        
        // Payment details
        this.addPaymentDetails(doc, reportData.payments);
        
        // Charts and graphs would be added here in a real implementation
        this.addFinancialCharts(doc, reportData);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate assignment submission report
   */
  async generateAssignmentReport(assignment, submissions, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        this.addHeader(doc, 'ASSIGNMENT REPORT');
        
        // Assignment information
        this.addAssignmentInfo(doc, assignment);
        
        // Submission statistics
        this.addSubmissionStats(doc, submissions);
        
        // Student submissions
        this.addStudentSubmissions(doc, submissions);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate certificate of completion
   */
  async generateCertificate(student, course, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ 
          margin: 0,
          size: 'A4',
          layout: 'landscape'
        });
        const chunks = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Certificate background (would be an image in real implementation)
        this.addCertificateBackground(doc);
        
        // Certificate content
        this.addCertificateContent(doc, student, course);
        
        // Signatures
        this.addCertificateSignatures(doc);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Private methods

  addHeader(doc, title) {
    // Institution logo and name
    doc.font(this.fonts.bold)
       .fontSize(20)
       .fillColor('#2c3e50')
       .text(process.env.SITE_NAME || 'EduLMS', 50, 50, { align: 'center' });
    
    doc.font(this.fonts.normal)
       .fontSize(12)
       .fillColor('#7f8c8d')
       .text('Learning Management System', 50, 75, { align: 'center' });
    
    // Title
    doc.font(this.fonts.bold)
       .fontSize(16)
       .fillColor('#2c3e50')
       .text(title, 50, 120, { align: 'center' });
    
    // Line separator
    doc.moveTo(50, 150)
       .lineTo(545, 150)
       .strokeColor('#bdc3c7')
       .lineWidth(1)
       .stroke();
    
    doc.y = 170;
  }

  addStudentInfo(doc, student) {
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50').text('STUDENT INFORMATION:', 50, doc.y);
    doc.y += 10;
    
    const info = [
      { label: 'Name', value: Formatters.formatName(student.first_name, student.last_name) },
      { label: 'Student ID', value: student.student_id },
      { label: 'Program', value: student.program },
      { label: 'Semester', value: Formatters.formatSemester(student.semester) },
      { label: 'Academic Year', value: Formatters.formatAcademicYear(student.academic_year) },
      { label: 'Date Generated', value: Helpers.formatDate(new Date()) }
    ];
    
    info.forEach(item => {
      doc.font(this.fonts.bold).fillColor('#2c3e50').text(`${item.label}:`, 50, doc.y);
      doc.font(this.fonts.normal).fillColor('#34495e').text(item.value, 150, doc.y);
      doc.y += 20;
    });
    
    doc.y += 10;
  }

  addAcademicSummary(doc, grades) {
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50').text('ACADEMIC SUMMARY:', 50, doc.y);
    doc.y += 10;
    
    const gpa = Helpers.calculateGPA(grades);
    const totalCredits = grades.reduce((sum, grade) => sum + grade.credits, 0);
    const completedCourses = grades.filter(grade => grade.grade !== 'F').length;
    
    const summary = [
      { label: 'Cumulative GPA', value: Helpers.formatGPA(gpa) },
      { label: 'Total Credits', value: totalCredits },
      { label: 'Completed Courses', value: completedCourses },
      { label: 'Overall Grade', value: Helpers.getGradeFromPercentage((gpa / 4.0) * 100) }
    ];
    
    summary.forEach(item => {
      doc.font(this.fonts.bold).fillColor('#2c3e50').text(`${item.label}:`, 50, doc.y);
      doc.font(this.fonts.normal).fillColor('#34495e').text(item.value, 180, doc.y);
      doc.y += 20;
    });
    
    doc.y += 10;
  }

  addCourseGrades(doc, grades) {
    doc.addPage();
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50').text('COURSE GRADES:', 50, 50);
    doc.y = 70;
    
    // Table header
    doc.font(this.fonts.bold).fillColor('#ffffff');
    doc.rect(50, doc.y, 495, 20).fill('#2c3e50');
    doc.text('Course Code', 55, doc.y + 5);
    doc.text('Course Title', 150, doc.y + 5);
    doc.text('Credits', 400, doc.y + 5);
    doc.text('Grade', 450, doc.y + 5);
    doc.text('Points', 500, doc.y + 5);
    doc.y += 25;
    
    // Table rows
    grades.forEach((grade, index) => {
      if (index % 2 === 0) {
        doc.rect(50, doc.y, 495, 20).fill('#f8f9fa');
      }
      
      doc.font(this.fonts.normal).fillColor('#2c3e50');
      doc.text(grade.course_code, 55, doc.y + 5);
      doc.text(grade.course_title, 150, doc.y + 5, { width: 240 });
      doc.text(grade.credits.toString(), 400, doc.y + 5);
      doc.text(grade.grade, 450, doc.y + 5);
      doc.text(Helpers.calculateGradePoint(grade.grade).toFixed(1), 500, doc.y + 5);
      
      doc.y += 20;
      
      // Add new page if needed
      if (doc.y > 700) {
        doc.addPage();
        doc.y = 50;
      }
    });
  }

  addFooter(doc, documentType) {
    const pageHeight = doc.page.height;
    
    doc.y = pageHeight - 100;
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .strokeColor('#bdc3c7')
       .lineWidth(1)
       .stroke();
    
    doc.y += 10;
    doc.font(this.fonts.normal).fontSize(10).fillColor('#7f8c8d');
    doc.text(`This ${documentType} was generated electronically on ${Helpers.formatDate(new Date())}`, 50, doc.y, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} ${process.env.SITE_NAME || 'EduLMS'}. All rights reserved.`, 50, doc.y + 15, { align: 'center' });
  }

  addInvoiceHeader(doc, invoice) {
    doc.font(this.fonts.bold).fontSize(20).fillColor('#2c3e50')
       .text('INVOICE', 50, 50);
    
    doc.font(this.fonts.normal).fontSize(12).fillColor('#7f8c8d')
       .text(`Invoice #: ${invoice.invoice_number}`, 400, 50);
    
    doc.font(this.fonts.normal).fontSize(12).fillColor('#7f8c8d')
       .text(`Date: ${Helpers.formatDate(invoice.created_at)}`, 400, 65);
  }

  addInvoiceInfo(doc, invoice, student) {
    doc.y = 100;
    
    // Bill To
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('BILL TO:', 50, doc.y);
    doc.font(this.fonts.normal).fontSize(10).fillColor('#34495e')
       .text(Formatters.formatName(student.first_name, student.last_name), 50, doc.y + 15);
    doc.text(`Student ID: ${student.student_id}`, 50, doc.y + 30);
    doc.text(`Program: ${student.program}`, 50, doc.y + 45);
    
    // Due Date
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('DUE DATE:', 300, doc.y);
    doc.font(this.fonts.normal).fontSize(10).fillColor('#34495e')
       .text(Helpers.formatDate(invoice.due_date), 300, doc.y + 15);
    
    doc.y = 180;
  }

  addInvoiceItems(doc, items) {
    // Table header
    doc.font(this.fonts.bold).fillColor('#ffffff');
    doc.rect(50, doc.y, 495, 20).fill('#2c3e50');
    doc.text('Description', 55, doc.y + 5);
    doc.text('Quantity', 350, doc.y + 5);
    doc.text('Unit Price', 400, doc.y + 5);
    doc.text('Amount', 480, doc.y + 5);
    doc.y += 25;
    
    // Table rows
    let subtotal = 0;
    
    items.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, doc.y, 495, 20).fill('#f8f9fa');
      }
      
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      
      doc.font(this.fonts.normal).fillColor('#2c3e50');
      doc.text(item.description, 55, doc.y + 5, { width: 280 });
      doc.text(item.quantity.toString(), 350, doc.y + 5);
      doc.text(Helpers.formatCurrency(item.unit_price), 400, doc.y + 5);
      doc.text(Helpers.formatCurrency(amount), 480, doc.y + 5);
      
      doc.y += 20;
    });
    
    doc.y += 10;
    
    // Totals
    doc.font(this.fonts.bold).fillColor('#2c3e50')
       .text('Subtotal:', 400, doc.y);
    doc.text(Helpers.formatCurrency(subtotal), 480, doc.y);
    
    doc.y += 20;
    doc.text('Total:', 400, doc.y);
    doc.text(Helpers.formatCurrency(subtotal), 480, doc.y);
  }

  addInvoiceTotals(doc, items) {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    doc.y += 40;
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('PAYMENT INFORMATION:', 50, doc.y);
    
    doc.y += 20;
    doc.font(this.fonts.normal).fontSize(10).fillColor('#34495e')
       .text('Amount Due: ' + Helpers.formatCurrency(total), 50, doc.y);
    doc.text('Payment Methods: M-Pesa, Bank Transfer, Cash', 50, doc.y + 15);
    doc.text('M-Pesa Paybill: 174379', 50, doc.y + 30);
    doc.text('Account Number: Your Student ID', 50, doc.y + 45);
  }

  addInvoiceTerms(doc) {
    doc.y += 80;
    doc.font(this.fonts.bold).fontSize(10).fillColor('#2c3e50')
       .text('TERMS AND CONDITIONS:', 50, doc.y);
    
    doc.y += 15;
    doc.font(this.fonts.normal).fontSize(8).fillColor('#7f8c8d')
       .text('1. Payment is due within 30 days of invoice date.', 50, doc.y, { width: 495 });
    doc.y += 12;
    doc.text('2. Late payments may incur additional fees.', 50, doc.y, { width: 495 });
    doc.y += 12;
    doc.text('3. For payment inquiries, contact finance department.', 50, doc.y, { width: 495 });
  }

  addFinancialSummary(doc, reportData) {
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('FINANCIAL SUMMARY:', 50, doc.y);
    doc.y += 10;
    
    const summary = [
      { label: 'Total Revenue', value: Helpers.formatCurrency(reportData.totalRevenue) },
      { label: 'Total Payments', value: reportData.totalPayments },
      { label: 'Outstanding Balance', value: Helpers.formatCurrency(reportData.outstandingBalance) },
      { label: 'Report Period', value: `${Helpers.formatDate(reportData.startDate)} - ${Helpers.formatDate(reportData.endDate)}` }
    ];
    
    summary.forEach(item => {
      doc.font(this.fonts.bold).fillColor('#2c3e50').text(`${item.label}:`, 50, doc.y);
      doc.font(this.fonts.normal).fillColor('#34495e').text(item.value, 200, doc.y);
      doc.y += 20;
    });
    
    doc.y += 10;
  }

  addPaymentDetails(doc, payments) {
    doc.addPage();
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('PAYMENT DETAILS:', 50, 50);
    doc.y = 70;
    
    // Table header
    doc.font(this.fonts.bold).fillColor('#ffffff');
    doc.rect(50, doc.y, 495, 20).fill('#2c3e50');
    doc.text('Date', 55, doc.y + 5);
    doc.text('Student', 120, doc.y + 5);
    doc.text('Description', 250, doc.y + 5);
    doc.text('Amount', 450, doc.y + 5);
    doc.y += 25;
    
    // Table rows
    payments.forEach((payment, index) => {
      if (index % 2 === 0) {
        doc.rect(50, doc.y, 495, 20).fill('#f8f9fa');
      }
      
      doc.font(this.fonts.normal).fillColor('#2c3e50');
      doc.text(Helpers.formatDate(payment.created_at), 55, doc.y + 5);
      doc.text(payment.student_name, 120, doc.y + 5, { width: 120 });
      doc.text(payment.description, 250, doc.y + 5, { width: 190 });
      doc.text(Helpers.formatCurrency(payment.amount), 450, doc.y + 5);
      
      doc.y += 20;
      
      if (doc.y > 700) {
        doc.addPage();
        doc.y = 50;
      }
    });
  }

  addFinancialCharts(doc, reportData) {
    // This would generate charts using a charting library
    // For now, we'll add placeholder text
    doc.addPage();
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('FINANCIAL CHARTS AND GRAPHS', 50, 50, { align: 'center' });
    
    doc.font(this.fonts.normal).fontSize(10).fillColor('#7f8c8d')
       .text('Revenue Trend', 50, 100);
    doc.text('Payment Methods Distribution', 50, 250);
    doc.text('Outstanding Fees by Program', 50, 400);
  }

  addCertificateBackground(doc) {
    // Add border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
       .strokeColor('#2c3e50')
       .lineWidth(3)
       .stroke();
    
    // Add decorative elements
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80)
       .strokeColor('#bdc3c7')
       .lineWidth(1)
       .stroke();
  }

  addCertificateContent(doc, student, course) {
    const centerX = doc.page.width / 2;
    
    // Title
    doc.font(this.fonts.bold).fontSize(28).fillColor('#2c3e50')
       .text('CERTIFICATE OF COMPLETION', centerX, 100, { align: 'center' });
    
    // Subtitle
    doc.font(this.fonts.normal).fontSize(16).fillColor('#7f8c8d')
       .text('This certifies that', centerX, 160, { align: 'center' });
    
    // Student name
    doc.font(this.fonts.bold).fontSize(24).fillColor('#e74c3c')
       .text(Formatters.formatName(student.first_name, student.last_name), centerX, 200, { align: 'center' });
    
    // Course completion text
    doc.font(this.fonts.normal).fontSize(14).fillColor('#34495e')
       .text('has successfully completed the course', centerX, 250, { align: 'center' });
    
    // Course name
    doc.font(this.fonts.bold).fontSize(18).fillColor('#2c3e50')
       .text(course.title, centerX, 290, { align: 'center' });
    
    // Course details
    doc.font(this.fonts.normal).fontSize(12).fillColor('#7f8c8d')
       .text(`Course Code: ${course.code} | Credits: ${course.credits} | Duration: ${course.duration} weeks`, centerX, 330, { align: 'center' });
    
    // Completion date
    doc.font(this.fonts.normal).fontSize(12).fillColor('#34495e')
       .text(`Completed on: ${Helpers.formatDate(new Date())}`, centerX, 370, { align: 'center' });
  }

  addCertificateSignatures(doc) {
    const centerX = doc.page.width / 2;
    
    doc.y = 450;
    
    // Institution signature
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('_________________________', centerX - 150, doc.y, { align: 'center' });
    doc.text('Academic Director', centerX - 150, doc.y + 20, { align: 'center' });
    doc.text(process.env.SITE_NAME || 'EduLMS', centerX - 150, doc.y + 40, { align: 'center' });
    
    // Date
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('_________________________', centerX + 150, doc.y, { align: 'center' });
    doc.text('Date', centerX + 150, doc.y + 20, { align: 'center' });
    doc.text(Helpers.formatDate(new Date()), centerX + 150, doc.y + 40, { align: 'center' });
  }

  addAssignmentInfo(doc, assignment) {
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('ASSIGNMENT INFORMATION:', 50, doc.y);
    doc.y += 10;
    
    const info = [
      { label: 'Title', value: assignment.title },
      { label: 'Course', value: `${assignment.course_code} - ${assignment.course_title}` },
      { label: 'Due Date', value: Helpers.formatDateTime(assignment.due_date) },
      { label: 'Total Points', value: assignment.total_points.toString() },
      { label: 'Status', value: Formatters.formatAssignmentStatus(assignment.status) }
    ];
    
    info.forEach(item => {
      doc.font(this.fonts.bold).fillColor('#2c3e50').text(`${item.label}:`, 50, doc.y);
      doc.font(this.fonts.normal).fillColor('#34495e').text(item.value, 150, doc.y);
      doc.y += 20;
    });
    
    doc.y += 10;
  }

  addSubmissionStats(doc, submissions) {
    const total = submissions.length;
    const submitted = submissions.filter(s => s.status === 'submitted' || s.status === 'graded').length;
    const graded = submissions.filter(s => s.status === 'graded').length;
    const late = submissions.filter(s => s.status === 'late').length;
    
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('SUBMISSION STATISTICS:', 50, doc.y);
    doc.y += 10;
    
    const stats = [
      { label: 'Total Students', value: total.toString() },
      { label: 'Submitted', value: `${submitted} (${((submitted / total) * 100).toFixed(1)}%)` },
      { label: 'Graded', value: `${graded} (${((graded / total) * 100).toFixed(1)}%)` },
      { label: 'Late Submissions', value: `${late} (${((late / total) * 100).toFixed(1)}%)` }
    ];
    
    stats.forEach(item => {
      doc.font(this.fonts.bold).fillColor('#2c3e50').text(`${item.label}:`, 50, doc.y);
      doc.font(this.fonts.normal).fillColor('#34495e').text(item.value, 180, doc.y);
      doc.y += 20;
    });
    
    doc.y += 10;
  }

  addStudentSubmissions(doc, submissions) {
    doc.addPage();
    doc.font(this.fonts.bold).fontSize(12).fillColor('#2c3e50')
       .text('STUDENT SUBMISSIONS:', 50, 50);
    doc.y = 70;
    
    // Table header
    doc.font(this.fonts.bold).fillColor('#ffffff');
    doc.rect(50, doc.y, 495, 20).fill('#2c3e50');
    doc.text('Student Name', 55, doc.y + 5);
    doc.text('Student ID', 200, doc.y + 5);
    doc.text('Submitted', 300, doc.y + 5);
    doc.text('Status', 380, doc.y + 5);
    doc.text('Score', 450, doc.y + 5);
    doc.y += 25;
    
    // Table rows
    submissions.forEach((submission, index) => {
      if (index % 2 === 0) {
        doc.rect(50, doc.y, 495, 20).fill('#f8f9fa');
      }
      
      doc.font(this.fonts.normal).fillColor('#2c3e50');
      doc.text(Formatters.formatName(submission.first_name, submission.last_name), 55, doc.y + 5);
      doc.text(submission.student_id, 200, doc.y + 5);
      doc.text(submission.submitted_at ? Helpers.formatDateTime(submission.submitted_at) : 'Not submitted', 300, doc.y + 5);
      doc.text(Formatters.formatSubmissionStatus(submission.status), 380, doc.y + 5);
      doc.text(submission.score !== null ? submission.score.toString() : '-', 450, doc.y + 5);
      
      doc.y += 20;
      
      if (doc.y > 700) {
        doc.addPage();
        doc.y = 50;
      }
    });
  }
}

module.exports = new PDFService();