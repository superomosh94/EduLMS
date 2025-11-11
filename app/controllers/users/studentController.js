const Student = require('../../models/Student');
const Course = require('../../models/Course');
const { Helpers, Formatters } = require('../../../utils');
const db = require('../../../config/database');

class StudentController {
  // Student dashboard
  async dashboard(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      
      // Get enrolled courses
      const enrollments = await Student.getEnrollments(req.user.id);
      
      // Get pending assignments
      const pendingAssignments = await db.query(`
        SELECT a.*, c.title as course_title, c.code as course_code
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON a.course_id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND a.status = 'published' 
        AND a.due_date > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM assignment_submissions s 
          WHERE s.assignment_id = a.id AND s.student_id = ?
        )
        ORDER BY a.due_date ASC
        LIMIT 5
      `, [req.user.id, req.user.id]);

      // Get recent grades
      const recentGrades = await db.query(`
        SELECT g.*, a.title as assignment_title, a.total_points, c.title as course_title
        FROM grades g
        JOIN assignments a ON g.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE g.student_id = ?
        ORDER BY g.created_at DESC
        LIMIT 5
      `, [req.user.id]);

      // Get fee balance
      const feeBalance = await db.query(
        'SELECT fee_balance FROM students WHERE user_id = ?',
        [req.user.id]
      );

      res.render('student/dashboard', {
        title: 'Student Dashboard - EduLMS',
        layout: 'layouts/student-layout',
        student,
        enrollments,
        pendingAssignments,
        recentGrades,
        feeBalance: feeBalance[0]?.fee_balance || 0
      });
    } catch (error) {
      console.error('Student dashboard error:', error);
      req.flash('error_msg', 'Error loading dashboard');
      res.redirect('/student/dashboard');
    }
  }

  // Course Management

  async listCourses(req, res) {
    try {
      const enrollments = await Student.getEnrollments(req.user.id);
      
      res.render('student/courses/list', {
        title: 'My Courses - EduLMS',
        layout: 'layouts/student-layout',
        enrollments
      });
    } catch (error) {
      console.error('List courses error:', error);
      req.flash('error_msg', 'Error loading courses');
      res.redirect('/student/dashboard');
    }
  }

  async availableCourses(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const category = req.query.category;
      const search = req.query.search;

      let query = `
        SELECT c.*, u.first_name as instructor_first_name, u.last_name as instructor_last_name,
               cat.name as category_name,
               COUNT(e.id) as enrollment_count
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN enrollments e ON c.id = e.course_id AND e.status = 'active'
        WHERE c.status = 'active' 
        AND c.start_date <= NOW() 
        AND c.end_date >= NOW()
        AND c.id NOT IN (
          SELECT course_id FROM enrollments 
          WHERE student_id = ? AND status IN ('active', 'pending')
        )
      `;
      let countQuery = `
        SELECT COUNT(*) as total
        FROM courses c
        WHERE c.status = 'active' 
        AND c.start_date <= NOW() 
        AND c.end_date >= NOW()
        AND c.id NOT IN (
          SELECT course_id FROM enrollments 
          WHERE student_id = ? AND status IN ('active', 'pending')
        )
      `;
      const params = [req.user.id];
      const countParams = [req.user.id];

      if (category) {
        query += ' AND c.category_id = ?';
        countQuery += ' AND c.category_id = ?';
        params.push(category);
        countParams.push(category);
      }

      if (search) {
        query += ' AND (c.title LIKE ? OR c.code LIKE ? OR c.description LIKE ?)';
        countQuery += ' AND (c.title LIKE ? OR c.code LIKE ? OR c.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      query += ' GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      const [courses, countResult] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
      ]);

      const totalPages = Math.ceil(countResult[0].total / limit);
      const categories = await db.query('SELECT * FROM categories ORDER BY name');

      res.render('student/courses/available', {
        title: 'Available Courses - EduLMS',
        layout: 'layouts/student-layout',
        courses,
        pagination: Helpers.generatePagination(page, totalPages, '/student/courses/available'),
        categories,
        currentCategory: category,
        searchQuery: search
      });
    } catch (error) {
      console.error('Available courses error:', error);
      req.flash('error_msg', 'Error loading available courses');
      res.redirect('/student/courses');
    }
  }

  async viewCourse(req, res) {
    try {
      const courseId = req.params.courseId;
      
      // Check if student is enrolled
      const isEnrolled = await Course.isStudentEnrolled(courseId, req.user.id);
      if (!isEnrolled) {
        req.flash('error_msg', 'You are not enrolled in this course');
        return res.redirect('/student/courses');
      }

      const course = await Course.findById(courseId);
      const materials = await Course.getMaterials(courseId);
      const assignments = await Course.getAssignments(courseId);

      res.render('student/courses/view', {
        title: `${course.title} - EduLMS`,
        layout: 'layouts/student-layout',
        course,
        materials,
        assignments
      });
    } catch (error) {
      console.error('View course error:', error);
      req.flash('error_msg', 'Error loading course');
      res.redirect('/student/courses');
    }
  }

  async enrollInCourse(req, res) {
    try {
      const courseId = req.params.courseId;
      
      // Check if already enrolled
      const isEnrolled = await Course.isStudentEnrolled(courseId, req.user.id);
      if (isEnrolled) {
        req.flash('error_msg', 'You are already enrolled in this course');
        return res.redirect('/student/courses');
      }

      // Check course capacity
      const course = await Course.findById(courseId);
      if (course.enrollment_count >= course.max_students) {
        req.flash('error_msg', 'Course is full. Cannot enroll at this time.');
        return res.redirect('/student/courses/available');
      }

      await db.query(
        'INSERT INTO enrollments (student_id, course_id, enrollment_date, status) VALUES (?, ?, NOW(), "active")',
        [req.user.id, courseId]
      );

      req.flash('success_msg', 'Successfully enrolled in course');
      res.redirect(`/student/courses/${courseId}`);
    } catch (error) {
      console.error('Enroll in course error:', error);
      req.flash('error_msg', 'Error enrolling in course');
      res.redirect('/student/courses/available');
    }
  }

  async dropCourse(req, res) {
    try {
      const courseId = req.params.courseId;
      
      await db.query(
        'UPDATE enrollments SET status = "dropped", updated_at = NOW() WHERE student_id = ? AND course_id = ?',
        [req.user.id, courseId]
      );

      req.flash('success_msg', 'Successfully dropped course');
      res.redirect('/student/courses');
    } catch (error) {
      console.error('Drop course error:', error);
      req.flash('error_msg', 'Error dropping course');
      res.redirect('/student/courses');
    }
  }

  async courseMaterials(req, res) {
    try {
      const courseId = req.params.courseId;
      
      // Check if student is enrolled
      const isEnrolled = await Course.isStudentEnrolled(courseId, req.user.id);
      if (!isEnrolled) {
        req.flash('error_msg', 'You are not enrolled in this course');
        return res.redirect('/student/courses');
      }

      const course = await Course.findById(courseId);
      const materials = await Course.getMaterials(courseId);

      res.render('student/courses/materials', {
        title: `Course Materials - ${course.title}`,
        layout: 'layouts/student-layout',
        course,
        materials
      });
    } catch (error) {
      console.error('Course materials error:', error);
      req.flash('error_msg', 'Error loading course materials');
      res.redirect('/student/courses');
    }
  }

  // Assignment Management

  async listAssignments(req, res) {
    try {
      const assignments = await db.query(`
        SELECT a.*, c.title as course_title, c.code as course_code,
               s.id as submission_id, s.status as submission_status, s.score, s.submitted_at
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON a.course_id = e.course_id
        LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = ?
        WHERE e.student_id = ? AND e.status = 'active'
        AND a.status = 'published'
        ORDER BY a.due_date ASC
      `, [req.user.id, req.user.id]);

      res.render('student/assignments/list', {
        title: 'My Assignments - EduLMS',
        layout: 'layouts/student-layout',
        assignments
      });
    } catch (error) {
      console.error('List assignments error:', error);
      req.flash('error_msg', 'Error loading assignments');
      res.redirect('/student/dashboard');
    }
  }

  async viewAssignment(req, res) {
    try {
      const assignmentId = req.params.assignmentId;
      
      const assignment = await db.query(`
        SELECT a.*, c.title as course_title, c.code as course_code,
               u.first_name as instructor_first_name, u.last_name as instructor_last_name,
               s.id as submission_id, s.status as submission_status, s.score, s.feedback, s.submitted_at
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = ?
        WHERE a.id = ? AND EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = a.course_id AND e.student_id = ? AND e.status = 'active'
        )
      `, [req.user.id, assignmentId, req.user.id]);

      if (assignment.length === 0) {
        req.flash('error_msg', 'Assignment not found or you are not enrolled in this course');
        return res.redirect('/student/assignments');
      }

      res.render('student/assignments/view', {
        title: `Assignment - ${assignment[0].title}`,
        layout: 'layouts/student-layout',
        assignment: assignment[0]
      });
    } catch (error) {
      console.error('View assignment error:', error);
      req.flash('error_msg', 'Error loading assignment');
      res.redirect('/student/assignments');
    }
  }

  async showSubmitAssignment(req, res) {
    try {
      const assignmentId = req.params.assignmentId;
      
      const assignment = await db.query(`
        SELECT a.*, c.title as course_title
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.id = ? AND EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = a.course_id AND e.student_id = ? AND e.status = 'active'
        )
      `, [assignmentId, req.user.id]);

      if (assignment.length === 0) {
        req.flash('error_msg', 'Assignment not found or you are not enrolled in this course');
        return res.redirect('/student/assignments');
      }

      // Check if assignment is still open
      if (new Date() > new Date(assignment[0].due_date)) {
        req.flash('error_msg', 'Assignment due date has passed');
        return res.redirect(`/student/assignments/${assignmentId}`);
      }

      res.render('student/assignments/submit', {
        title: `Submit Assignment - ${assignment[0].title}`,
        layout: 'layouts/student-layout',
        assignment: assignment[0]
      });
    } catch (error) {
      console.error('Show submit assignment error:', error);
      req.flash('error_msg', 'Error loading submission form');
      res.redirect('/student/assignments');
    }
  }

  async submitAssignment(req, res) {
    try {
      const assignmentId = req.params.assignmentId;
      const { content, submission_notes } = req.body;

      // Check if assignment exists and is open
      const assignment = await db.query(`
        SELECT a.* FROM assignments a
        WHERE a.id = ? AND a.status = 'published'
        AND EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = a.course_id AND e.student_id = ? AND e.status = 'active'
        )
      `, [assignmentId, req.user.id]);

      if (assignment.length === 0) {
        req.flash('error_msg', 'Assignment not found or you are not enrolled in this course');
        return res.redirect('/student/assignments');
      }

      // Check if due date has passed
      if (new Date() > new Date(assignment[0].due_date)) {
        req.flash('error_msg', 'Assignment due date has passed');
        return res.redirect(`/student/assignments/${assignmentId}`);
      }

      // Check if already submitted
      const existingSubmission = await db.query(
        'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
        [assignmentId, req.user.id]
      );

      if (existingSubmission.length > 0) {
        req.flash('error_msg', 'You have already submitted this assignment');
        return res.redirect(`/student/assignments/${assignmentId}`);
      }

      // Determine submission status (late or on-time)
      const submissionStatus = new Date() > new Date(assignment[0].due_date) ? 'late' : 'submitted';

      await db.query(
        `INSERT INTO assignment_submissions 
         (assignment_id, student_id, content, submission_notes, status, submitted_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [assignmentId, req.user.id, content, submission_notes, submissionStatus]
      );

      req.flash('success_msg', 'Assignment submitted successfully');
      res.redirect(`/student/assignments/${assignmentId}`);
    } catch (error) {
      console.error('Submit assignment error:', error);
      req.flash('error_msg', 'Error submitting assignment');
      res.redirect(`/student/assignments/${req.params.assignmentId}/submit`);
    }
  }

  async viewSubmission(req, res) {
    try {
      const submissionId = req.params.submissionId;
      
      const submission = await db.query(`
        SELECT s.*, a.title as assignment_title, a.total_points, c.title as course_title
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE s.id = ? AND s.student_id = ?
      `, [submissionId, req.user.id]);

      if (submission.length === 0) {
        req.flash('error_msg', 'Submission not found');
        return res.redirect('/student/assignments');
      }

      res.render('student/assignments/submitted', {
        title: `Submission Details - ${submission[0].assignment_title}`,
        layout: 'layouts/student-layout',
        submission: submission[0]
      });
    } catch (error) {
      console.error('View submission error:', error);
      req.flash('error_msg', 'Error loading submission');
      res.redirect('/student/assignments');
    }
  }

  // Grades and Progress

  async gradesOverview(req, res) {
    try {
      const grades = await Student.getGrades(req.user.id);
      
      // Calculate GPA and statistics
      let totalCredits = 0;
      let totalPoints = 0;
      const courseGrades = {};

      grades.forEach(grade => {
        if (grade.grade && grade.credits) {
          const gradePoint = Helpers.calculateGradePoint(grade.grade);
          totalPoints += gradePoint * grade.credits;
          totalCredits += grade.credits;
          
          if (!courseGrades[grade.course_title]) {
            courseGrades[grade.course_title] = {
              grades: [],
              totalPoints: 0,
              totalCredits: 0
            };
          }
          courseGrades[grade.course_title].grades.push(grade);
          courseGrades[grade.course_title].totalPoints += gradePoint * grade.credits;
          courseGrades[grade.course_title].totalCredits += grade.credits;
        }
      });

      const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

      res.render('student/grades/overview', {
        title: 'My Grades - EduLMS',
        layout: 'layouts/student-layout',
        grades,
        courseGrades,
        gpa: gpa.toFixed(2),
        totalCredits
      });
    } catch (error) {
      console.error('Grades overview error:', error);
      req.flash('error_msg', 'Error loading grades');
      res.redirect('/student/dashboard');
    }
  }

  async courseGrades(req, res) {
    try {
      const courseId = req.params.courseId;
      
      // Check if enrolled
      const isEnrolled = await Course.isStudentEnrolled(courseId, req.user.id);
      if (!isEnrolled) {
        req.flash('error_msg', 'You are not enrolled in this course');
        return res.redirect('/student/grades');
      }

      const grades = await db.query(`
        SELECT g.*, a.title as assignment_title, a.total_points, a.due_date
        FROM grades g
        JOIN assignments a ON g.assignment_id = a.id
        WHERE g.student_id = ? AND a.course_id = ?
        ORDER BY a.due_date
      `, [req.user.id, courseId]);

      const course = await Course.findById(courseId);

      res.render('student/grades/course-grades', {
        title: `Grades - ${course.title}`,
        layout: 'layouts/student-layout',
        grades,
        course
      });
    } catch (error) {
      console.error('Course grades error:', error);
      req.flash('error_msg', 'Error loading course grades');
      res.redirect('/student/grades');
    }
  }

  async academicTranscript(req, res) {
    try {
      const grades = await Student.getGrades(req.user.id);
      const student = await Student.findByUserId(req.user.id);

      res.render('student/grades/transcript', {
        title: 'Academic Transcript - EduLMS',
        layout: 'layouts/student-layout',
        grades,
        student
      });
    } catch (error) {
      console.error('Academic transcript error:', error);
      req.flash('error_msg', 'Error loading transcript');
      res.redirect('/student/grades');
    }
  }

  async academicProgress(req, res) {
    try {
      const enrollments = await Student.getEnrollments(req.user.id);
      const progressData = [];

      for (const enrollment of enrollments) {
        const assignments = await db.query(`
          SELECT a.id, a.title, a.due_date, s.status as submission_status
          FROM assignments a
          LEFT JOIN assignment_submissions s ON a.id = s.assignment_id AND s.student_id = ?
          WHERE a.course_id = ? AND a.status = 'published'
        `, [req.user.id, enrollment.course_id]);

        const totalAssignments = assignments.length;
        const submittedAssignments = assignments.filter(a => a.submission_status).length;
        const progress = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0;

        progressData.push({
          course: enrollment,
          totalAssignments,
          submittedAssignments,
          progress: progress.toFixed(1)
        });
      }

      res.render('student/grades/progress', {
        title: 'Academic Progress - EduLMS',
        layout: 'layouts/student-layout',
        progressData
      });
    } catch (error) {
      console.error('Academic progress error:', error);
      req.flash('error_msg', 'Error loading academic progress');
      res.redirect('/student/dashboard');
    }
  }

  // Payment Management

  async paymentHistory(req, res) {
    try {
      const payments = await db.query(`
        SELECT p.*, f.name as fee_name
        FROM payments p
        LEFT JOIN fee_structures f ON p.fee_structure_id = f.id
        WHERE p.student_id = ?
        ORDER BY p.created_at DESC
      `, [req.user.id]);

      res.render('student/payments/history', {
        title: 'Payment History - EduLMS',
        layout: 'layouts/student-layout',
        payments
      });
    } catch (error) {
      console.error('Payment history error:', error);
      req.flash('error_msg', 'Error loading payment history');
      res.redirect('/student/dashboard');
    }
  }

  async showMakePayment(req, res) {
    try {
      const feeStructures = await db.query(`
        SELECT * FROM fee_structures 
        WHERE is_active = 1 
        ORDER BY fee_type, amount
      `);

      const student = await Student.findByUserId(req.user.id);

      res.render('student/payments/make-payment', {
        title: 'Make Payment - EduLMS',
        layout: 'layouts/student-layout',
        feeStructures,
        feeBalance: student.fee_balance || 0
      });
    } catch (error) {
      console.error('Show make payment error:', error);
      req.flash('error_msg', 'Error loading payment form');
      res.redirect('/student/payments/history');
    }
  }

  async processPayment(req, res) {
    try {
      const { amount, fee_type, description } = req.body;

      // Create payment record
      const paymentId = await db.query(
        `INSERT INTO payments 
         (student_id, amount, fee_type, description, status, payment_method, created_at) 
         VALUES (?, ?, ?, ?, 'pending', 'mpesa', NOW())`,
        [req.user.id, amount, fee_type, description]
      );

      // Redirect to M-Pesa payment processing
      res.redirect(`/student/payments/mpesa-payment/${paymentId.insertId}`);
    } catch (error) {
      console.error('Process payment error:', error);
      req.flash('error_msg', 'Error processing payment');
      res.redirect('/student/payments/make-payment');
    }
  }

  async viewInvoice(req, res) {
    try {
      const invoiceId = req.params.invoiceId;
      
      const invoice = await db.query(`
        SELECT i.*, u.first_name, u.last_name, s.student_id
        FROM invoices i
        JOIN users u ON i.student_id = u.id
        LEFT JOIN students s ON i.student_id = s.user_id
        WHERE i.id = ? AND i.student_id = ?
      `, [invoiceId, req.user.id]);

      if (invoice.length === 0) {
        req.flash('error_msg', 'Invoice not found');
        return res.redirect('/student/payments/history');
      }

      const items = await db.query(`
        SELECT * FROM invoice_items WHERE invoice_id = ?
      `, [invoiceId]);

      res.render('student/payments/invoice', {
        title: `Invoice #${invoice[0].invoice_number} - EduLMS`,
        layout: 'layouts/student-layout',
        invoice: invoice[0],
        items
      });
    } catch (error) {
      console.error('View invoice error:', error);
      req.flash('error_msg', 'Error loading invoice');
      res.redirect('/student/payments/history');
    }
  }

  async feeStatement(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      const payments = await db.query(`
        SELECT * FROM payments 
        WHERE student_id = ? 
        ORDER BY created_at DESC
      `, [req.user.id]);

      const invoices = await db.query(`
        SELECT * FROM invoices 
        WHERE student_id = ? 
        ORDER BY created_at DESC
      `, [req.user.id]);

      res.render('student/payments/fee-statement', {
        title: 'Fee Statement - EduLMS',
        layout: 'layouts/student-layout',
        student,
        payments,
        invoices,
        totalPaid: payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
      });
    } catch (error) {
      console.error('Fee statement error:', error);
      req.flash('error_msg', 'Error loading fee statement');
      res.redirect('/student/dashboard');
    }
  }

  async paymentSuccess(req, res) {
    try {
      const paymentId = req.params.paymentId;
      
      const payment = await db.query(`
        SELECT p.*, u.first_name, u.last_name
        FROM payments p
        JOIN users u ON p.student_id = u.id
        WHERE p.id = ? AND p.student_id = ?
      `, [paymentId, req.user.id]);

      if (payment.length === 0) {
        req.flash('error_msg', 'Payment not found');
        return res.redirect('/student/payments/history');
      }

      res.render('student/payments/payment-success', {
        title: 'Payment Successful - EduLMS',
        layout: 'layouts/student-layout',
        payment: payment[0]
      });
    } catch (error) {
      console.error('Payment success error:', error);
      req.flash('error_msg', 'Error loading payment confirmation');
      res.redirect('/student/payments/history');
    }
  }

  // Profile Management

  async viewProfile(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      
      res.render('student/profile/view', {
        title: 'My Profile - EduLMS',
        layout: 'layouts/student-layout',
        student
      });
    } catch (error) {
      console.error('View profile error:', error);
      req.flash('error_msg', 'Error loading profile');
      res.redirect('/student/dashboard');
    }
  }

  async showEditProfile(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      
      res.render('student/profile/edit', {
        title: 'Edit Profile - EduLMS',
        layout: 'layouts/student-layout',
        student,
        formData: req.flash('formData')[0] || student
      });
    } catch (error) {
      console.error('Show edit profile error:', error);
      req.flash('error_msg', 'Error loading edit form');
      res.redirect('/student/profile');
    }
  }

  async updateProfile(req, res) {
    try {
      const { phone, address, date_of_birth, gender, program, semester, year, parent_name, parent_phone, emergency_contact } = req.body;

      // Update user profile
      await db.query(
        'UPDATE users SET phone = ?, address = ?, date_of_birth = ?, gender = ?, updated_at = NOW() WHERE id = ?',
        [phone, address, date_of_birth, gender, req.user.id]
      );

      // Update student profile
      await db.query(
        `UPDATE students SET program = ?, semester = ?, year = ?, parent_name = ?, 
         parent_phone = ?, emergency_contact = ?, updated_at = NOW() WHERE user_id = ?`,
        [program, semester, year, parent_name, parent_phone, emergency_contact, req.user.id]
      );

      req.flash('success_msg', 'Profile updated successfully');
      res.redirect('/student/profile');
    } catch (error) {
      console.error('Update profile error:', error);
      req.flash('error_msg', 'Error updating profile');
      req.flash('formData', req.body);
      res.redirect('/student/profile/edit');
    }
  }

  async academicRecord(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      const enrollments = await Student.getEnrollments(req.user.id);
      const grades = await Student.getGrades(req.user.id);

      res.render('student/profile/academic-record', {
        title: 'Academic Record - EduLMS',
        layout: 'layouts/student-layout',
        student,
        enrollments,
        grades
      });
    } catch (error) {
      console.error('Academic record error:', error);
      req.flash('error_msg', 'Error loading academic record');
      res.redirect('/student/profile');
    }
  }

  // Notifications

  async listNotifications(req, res) {
    try {
      const notifications = await db.query(`
        SELECT n.*, u.first_name as sender_first_name, u.last_name as sender_last_name
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 50
      `, [req.user.id]);

      res.render('student/notifications/list', {
        title: 'Notifications - EduLMS',
        layout: 'layouts/student-layout',
        notifications
      });
    } catch (error) {
      console.error('List notifications error:', error);
      req.flash('error_msg', 'Error loading notifications');
      res.redirect('/student/dashboard');
    }
  }

  async viewNotification(req, res) {
    try {
      const notificationId = req.params.notificationId;
      
      const notification = await db.query(`
        SELECT n.*, u.first_name as sender_first_name, u.last_name as sender_last_name
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.id = ? AND n.user_id = ?
      `, [notificationId, req.user.id]);

      if (notification.length === 0) {
        req.flash('error_msg', 'Notification not found');
        return res.redirect('/student/notifications');
      }

      // Mark as read
      await db.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?',
        [notificationId]
      );

      res.render('student/notifications/view', {
        title: `Notification - ${notification[0].title}`,
        layout: 'layouts/student-layout',
        notification: notification[0]
      });
    } catch (error) {
      console.error('View notification error:', error);
      req.flash('error_msg', 'Error loading notification');
      res.redirect('/student/notifications');
    }
  }

  async markNotificationsRead(req, res) {
    try {
      await db.query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
        [req.user.id]
      );

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Mark notifications read error:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking notifications as read'
      });
    }
  }

  // API endpoints

  async getEnrolledCourses(req, res) {
    try {
      const enrollments = await Student.getEnrollments(req.user.id);
      
      res.json({
        success: true,
        courses: enrollments
      });
    } catch (error) {
      console.error('Get enrolled courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching enrolled courses'
      });
    }
  }

  async getPendingAssignments(req, res) {
    try {
      const assignments = await db.query(`
        SELECT a.*, c.title as course_title
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON a.course_id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND a.status = 'published' 
        AND a.due_date > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM assignment_submissions s 
          WHERE s.assignment_id = a.id AND s.student_id = ?
        )
        ORDER BY a.due_date ASC
      `, [req.user.id, req.user.id]);

      res.json({
        success: true,
        assignments
      });
    } catch (error) {
      console.error('Get pending assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching pending assignments'
      });
    }
  }

  async getGradesSummary(req, res) {
    try {
      const grades = await Student.getGrades(req.user.id);
      
      let totalCredits = 0;
      let totalPoints = 0;

      grades.forEach(grade => {
        if (grade.grade && grade.credits) {
          const gradePoint = Helpers.calculateGradePoint(grade.grade);
          totalPoints += gradePoint * grade.credits;
          totalCredits += grade.credits;
        }
      });

      const gpa = totalCredits > 0 ? totalPoints / totalCredits : 0;

      res.json({
        success: true,
        summary: {
          gpa: gpa.toFixed(2),
          totalCredits,
          totalCourses: new Set(grades.map(g => g.course_title)).size
        }
      });
    } catch (error) {
      console.error('Get grades summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching grades summary'
      });
    }
  }

  async getFeeBalance(req, res) {
    try {
      const student = await Student.findByUserId(req.user.id);
      
      res.json({
        success: true,
        balance: student.fee_balance || 0
      });
    } catch (error) {
      console.error('Get fee balance error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching fee balance'
      });
    }
  }

  // File downloads

  async downloadCourseMaterial(req, res) {
    try {
      const materialId = req.params.materialId;
      
      const material = await db.query(`
        SELECT cm.*, c.title as course_title
        FROM course_materials cm
        JOIN courses c ON cm.course_id = c.id
        WHERE cm.id = ? AND EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = cm.course_id AND e.student_id = ? AND e.status = 'active'
        )
      `, [materialId, req.user.id]);

      if (material.length === 0) {
        req.flash('error_msg', 'Material not found or access denied');
        return res.redirect('/student/courses');
      }

      // This would serve the file for download
      req.flash('success_msg', 'Download started');
      res.redirect('back');
    } catch (error) {
      console.error('Download course material error:', error);
      req.flash('error_msg', 'Error downloading material');
      res.redirect('back');
    }
  }

  async downloadAssignmentFile(req, res) {
    try {
      const assignmentId = req.params.assignmentId;
      
      const assignment = await db.query(`
        SELECT a.* FROM assignments a
        WHERE a.id = ? AND EXISTS (
          SELECT 1 FROM enrollments e 
          WHERE e.course_id = a.course_id AND e.student_id = ? AND e.status = 'active'
        )
      `, [assignmentId, req.user.id]);

      if (assignment.length === 0) {
        req.flash('error_msg', 'Assignment not found or access denied');
        return res.redirect('/student/assignments');
      }

      // This would serve the assignment file for download
      req.flash('success_msg', 'Download started');
      res.redirect('back');
    } catch (error) {
      console.error('Download assignment file error:', error);
      req.flash('error_msg', 'Error downloading assignment file');
      res.redirect('back');
    }
  }

  async downloadTranscript(req, res) {
    try {
      const pdfService = require('../../services/pdfService');
      const student = await Student.findByUserId(req.user.id);
      const grades = await Student.getGrades(req.user.id);

      const pdfBuffer = await pdfService.generateTranscript(student, grades);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=transcript-${student.student_id}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Download transcript error:', error);
      req.flash('error_msg', 'Error generating transcript');
      res.redirect('/student/grades/transcript');
    }
  }

  // Calendar and Schedule

  async classSchedule(req, res) {
    try {
      const schedule = await db.query(`
        SELECT c.*, u.first_name as instructor_first_name, u.last_name as instructor_last_name
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        JOIN enrollments e ON c.id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND c.status = 'active'
        ORDER BY c.start_date, c.code
      `, [req.user.id]);

      res.render('student/schedule', {
        title: 'Class Schedule - EduLMS',
        layout: 'layouts/student-layout',
        schedule
      });
    } catch (error) {
      console.error('Class schedule error:', error);
      req.flash('error_msg', 'Error loading class schedule');
      res.redirect('/student/dashboard');
    }
  }

  async academicCalendar(req, res) {
    try {
      res.render('student/calendar', {
        title: 'Academic Calendar - EduLMS',
        layout: 'layouts/student-layout'
      });
    } catch (error) {
      console.error('Academic calendar error:', error);
      req.flash('error_msg', 'Error loading academic calendar');
      res.redirect('/student/dashboard');
    }
  }

  async getCalendarEvents(req, res) {
    try {
      const events = await db.query(`
        SELECT 
          a.due_date as start,
          a.title,
          'assignment' as type,
          c.title as course_title
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        JOIN enrollments e ON a.course_id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND a.status = 'published'
        AND a.due_date >= NOW()
        
        UNION ALL
        
        SELECT 
          c.start_date as start,
          CONCAT(c.title, ' - Starts') as title,
          'course_start' as type,
          c.title as course_title
        FROM courses c
        JOIN enrollments e ON c.id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND c.start_date >= NOW()
        
        UNION ALL
        
        SELECT 
          c.end_date as start,
          CONCAT(c.title, ' - Ends') as title,
          'course_end' as type,
          c.title as course_title
        FROM courses c
        JOIN enrollments e ON c.id = e.course_id
        WHERE e.student_id = ? AND e.status = 'active'
        AND c.end_date >= NOW()
        
        ORDER BY start
      `, [req.user.id, req.user.id, req.user.id]);

      res.json({
        success: true,
        events
      });
    } catch (error) {
      console.error('Get calendar events error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching calendar events'
      });
    }
  }

  // Support and Help

  async supportResources(req, res) {
    try {
      res.render('student/support', {
        title: 'Support Resources - EduLMS',
        layout: 'layouts/student-layout'
      });
    } catch (error) {
      console.error('Support resources error:', error);
      req.flash('error_msg', 'Error loading support resources');
      res.redirect('/student/dashboard');
    }
  }

  async submitSupportTicket(req, res) {
    try {
      const { subject, message, category } = req.body;

      await db.query(
        `INSERT INTO support_tickets 
         (student_id, subject, message, category, status, created_at) 
         VALUES (?, ?, ?, ?, 'open', NOW())`,
        [req.user.id, subject, message, category]
      );

      req.flash('success_msg', 'Support ticket submitted successfully');
      res.redirect('/student/support');
    } catch (error) {
      console.error('Submit support ticket error:', error);
      req.flash('error_msg', 'Error submitting support ticket');
      res.redirect('/student/support');
    }
  }
}

module.exports = new StudentController();