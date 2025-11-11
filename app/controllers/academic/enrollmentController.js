const Enrollment = require('../../models/Enrollment');
const Course = require('../../models/Course');
const Student = require('../../models/Student');
const { validationResult } = require('express-validator');
const { emailService } = require('../../services/emailService');

const enrollmentController = {
  // Enroll student in course
  enrollStudent: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { courseId, studentId } = req.body;

      // Verify course exists and is active
      const course = await Course.findById(courseId);
      if (!course || course.status !== 'active') {
        return res.status(404).json({
          success: false,
          message: 'Course not found or not active'
        });
      }

      // Verify student exists
      const student = await Student.findById(studentId).populate('user');
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      // Check if student is already enrolled
      const existingEnrollment = await Enrollment.findOne({
        student: studentId,
        course: courseId,
        status: { $in: ['active', 'pending'] }
      });

      if (existingEnrollment) {
        return res.status(400).json({
          success: false,
          message: 'Student is already enrolled or has a pending enrollment in this course'
        });
      }

      // Check course capacity
      const currentEnrollments = await Enrollment.countDocuments({
        course: courseId,
        status: 'active'
      });

      if (currentEnrollments >= course.maxStudents) {
        return res.status(400).json({
          success: false,
          message: 'Course has reached maximum capacity'
        });
      }

      // Check prerequisites
      if (course.prerequisites && course.prerequisites.length > 0) {
        const completedPrerequisites = await Enrollment.find({
          student: studentId,
          course: { $in: course.prerequisites },
          status: 'completed'
        });

        if (completedPrerequisites.length < course.prerequisites.length) {
          return res.status(400).json({
            success: false,
            message: 'Student has not completed all prerequisites'
          });
        }
      }

      const enrollment = new Enrollment({
        student: studentId,
        course: courseId,
        enrolledBy: req.user.id,
        enrollmentDate: new Date(),
        status: 'active'
      });

      await enrollment.save();
      await enrollment.populate('student', 'studentId user');
      await enrollment.populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      });
      await enrollment.populate('course', 'courseCode courseName instructor');
      await enrollment.populate('enrolledBy', 'firstName lastName');

      // Send enrollment confirmation email
      try {
        await emailService.sendEnrollmentConfirmation(
          student.user.email,
          student.user.firstName,
          course
        );
      } catch (emailError) {
        console.error('Failed to send enrollment email:', emailError);
        // Don't fail the request if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Student enrolled successfully',
        data: enrollment
      });
    } catch (error) {
      console.error('Enroll student error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Student self-enrollment
  selfEnroll: async (req, res) => {
    try {
      const { courseId } = req.body;
      const studentId = req.user.id;

      // Verify course exists and is active
      const course = await Course.findById(courseId);
      if (!course || course.status !== 'active') {
        return res.status(404).json({
          success: false,
          message: 'Course not found or not active'
        });
      }

      // Check if self-enrollment is allowed
      if (!course.allowSelfEnrollment) {
        return res.status(400).json({
          success: false,
          message: 'Self-enrollment is not allowed for this course'
        });
      }

      // Check if student is already enrolled
      const existingEnrollment = await Enrollment.findOne({
        student: studentId,
        course: courseId,
        status: { $in: ['active', 'pending'] }
      });

      if (existingEnrollment) {
        return res.status(400).json({
          success: false,
          message: 'You are already enrolled or have a pending enrollment in this course'
        });
      }

      // Check course capacity
      const currentEnrollments = await Enrollment.countDocuments({
        course: courseId,
        status: 'active'
      });

      if (currentEnrollments >= course.maxStudents) {
        return res.status(400).json({
          success: false,
          message: 'Course has reached maximum capacity'
        });
      }

      // Check prerequisites
      if (course.prerequisites && course.prerequisites.length > 0) {
        const completedPrerequisites = await Enrollment.find({
          student: studentId,
          course: { $in: course.prerequisites },
          status: 'completed'
        });

        if (completedPrerequisites.length < course.prerequisites.length) {
          return res.status(400).json({
            success: false,
            message: 'You have not completed all prerequisites for this course'
          });
        }
      }

      const enrollment = new Enrollment({
        student: studentId,
        course: courseId,
        enrolledBy: studentId,
        enrollmentDate: new Date(),
        status: 'active'
      });

      await enrollment.save();
      await enrollment.populate('course', 'courseCode courseName instructor');

      // Get student info for email
      const student = await Student.findById(studentId).populate('user');

      // Send enrollment confirmation email
      try {
        await emailService.sendEnrollmentConfirmation(
          student.user.email,
          student.user.firstName,
          course
        );
      } catch (emailError) {
        console.error('Failed to send enrollment email:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Enrolled in course successfully',
        data: enrollment
      });
    } catch (error) {
      console.error('Self-enroll error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get enrollments for course
  getCourseEnrollments: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { 
        page = 1, 
        limit = 50, 
        status,
        includeStudentDetails = false 
      } = req.query;

      const filter = { course: courseId };
      if (status) filter.status = status;

      let populateQuery = [
        { path: 'student', select: 'studentId user' },
        { 
          path: 'student', 
          populate: { path: 'user', select: 'firstName lastName email' } 
        }
      ];

      if (includeStudentDetails === 'true') {
        populateQuery.push(
          { path: 'enrolledBy', select: 'firstName lastName' }
        );
      }

      const enrollments = await Enrollment.find(filter)
        .populate(populateQuery)
        .sort({ enrollmentDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Enrollment.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          enrollments,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get course enrollments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get student enrollments
  getStudentEnrollments: async (req, res) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.params.studentId;
      const { 
        page = 1, 
        limit = 20, 
        status,
        academicYear,
        semester 
      } = req.query;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const filter = { student: studentId };
      if (status) filter.status = status;

      const enrollments = await Enrollment.find(filter)
        .populate('course', 'courseCode courseName credits department instructor')
        .populate({
          path: 'course',
          populate: { path: 'instructor', select: 'firstName lastName' }
        })
        .sort({ enrollmentDate: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Filter by academic year and semester if provided
      let filteredEnrollments = enrollments;
      if (academicYear || semester) {
        filteredEnrollments = enrollments.filter(enrollment => {
          const course = enrollment.course;
          let matches = true;
          
          if (academicYear && course.academicYear !== academicYear) {
            matches = false;
          }
          if (semester && course.semester !== semester) {
            matches = false;
          }
          
          return matches;
        });
      }

      const total = await Enrollment.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          enrollments: filteredEnrollments,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get student enrollments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update enrollment status
  updateEnrollmentStatus: async (req, res) => {
    try {
      const { enrollmentId } = req.params;
      const { status, completionDate, grade } = req.body;

      const validStatuses = ['active', 'completed', 'dropped', 'withdrawn', 'pending'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const enrollment = await Enrollment.findById(enrollmentId)
        .populate('course')
        .populate('student', 'studentId user');

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: 'Enrollment not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student' && enrollment.student._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      enrollment.status = status;
      
      if (status === 'completed' && completionDate) {
        enrollment.completionDate = completionDate;
        enrollment.finalGrade = grade;
      }

      if (status === 'dropped' || status === 'withdrawn') {
        enrollment.dropDate = new Date();
      }

      enrollment.updatedBy = req.user.id;
      await enrollment.save();

      res.status(200).json({
        success: true,
        message: 'Enrollment status updated successfully',
        data: enrollment
      });
    } catch (error) {
      console.error('Update enrollment status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Drop enrollment (student self-drop)
  dropEnrollment: async (req, res) => {
    try {
      const { enrollmentId } = req.params;

      const enrollment = await Enrollment.findById(enrollmentId)
        .populate('course');

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: 'Enrollment not found'
        });
      }

      // Check if student owns this enrollment
      if (enrollment.student.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if drop is allowed (e.g., not after drop deadline)
      const dropDeadline = new Date(enrollment.course.startDate);
      dropDeadline.setDate(dropDeadline.getDate() + 14); // 2 weeks after start

      if (new Date() > dropDeadline) {
        return res.status(400).json({
          success: false,
          message: 'Drop deadline has passed'
        });
      }

      enrollment.status = 'dropped';
      enrollment.dropDate = new Date();
      enrollment.updatedBy = req.user.id;
      await enrollment.save();

      res.status(200).json({
        success: true,
        message: 'Successfully dropped from course',
        data: enrollment
      });
    } catch (error) {
      console.error('Drop enrollment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Bulk enroll students
  bulkEnrollStudents: async (req, res) => {
    try {
      const { courseId, studentIds } = req.body;

      if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({
          success: false,
          message: 'Student IDs array is required'
        });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const results = {
        successful: [],
        failed: []
      };

      for (const studentId of studentIds) {
        try {
          // Check if already enrolled
          const existingEnrollment = await Enrollment.findOne({
            student: studentId,
            course: courseId,
            status: { $in: ['active', 'pending'] }
          });

          if (existingEnrollment) {
            results.failed.push({
              studentId,
              error: 'Already enrolled'
            });
            continue;
          }

          const enrollment = new Enrollment({
            student: studentId,
            course: courseId,
            enrolledBy: req.user.id,
            enrollmentDate: new Date(),
            status: 'active'
          });

          await enrollment.save();
          results.successful.push(studentId);

        } catch (error) {
          results.failed.push({
            studentId,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk enrollment completed. Successful: ${results.successful.length}, Failed: ${results.failed.length}`,
        data: results
      });
    } catch (error) {
      console.error('Bulk enroll error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get enrollment statistics
  getEnrollmentStats: async (req, res) => {
    try {
      const { academicYear, semester } = req.query;
      const filter = {};

      if (academicYear) filter.academicYear = academicYear;
      if (semester) filter.semester = semester;

      const stats = await Enrollment.aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: '$course' },
        { $match: filter },
        {
          $group: {
            _id: '$course.department',
            totalEnrollments: { $sum: 1 },
            activeEnrollments: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedEnrollments: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]);

      const statusStats = await Enrollment.aggregate([
        {
          $lookup: {
            from: 'courses',
            localField: 'course',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: '$course' },
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          departmentStats: stats,
          statusStats,
          academicYear,
          semester
        }
      });
    } catch (error) {
      console.error('Get enrollment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = enrollmentController;