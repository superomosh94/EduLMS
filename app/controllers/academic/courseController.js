const db = require('../../../config/database');
const Course = require('../../models/Course');
const { ROLES } = require('../../../config/constants');

const courseController = {
  // List all courses (with pagination and filtering)
  listCourses: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const category = req.query.category || '';
      const instructor = req.query.instructor || '';
      const level = req.query.level || '';
      const search = req.query.search || '';

      const filters = {};
      if (category) filters.category = category;
      if (instructor) filters.instructor = instructor;
      if (level) filters.level = level;
      if (search) filters.search = search;

      const coursesData = await Course.getCourses(filters, page, limit);

      res.json({
        success: true,
        data: {
          courses: coursesData.courses,
          pagination: {
            current: page,
            pages: coursesData.totalPages,
            total: coursesData.total
          }
        }
      });
    } catch (error) {
      console.error('List courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading courses',
        error: error.message
      });
    }
  },

  // List public courses (no authentication required)
  listPublicCourses: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 8;

      const coursesData = await Course.getPublicCourses(page, limit);

      res.json({
        success: true,
        data: {
          courses: coursesData.courses,
          pagination: {
            current: page,
            pages: coursesData.totalPages,
            total: coursesData.total
          }
        }
      });
    } catch (error) {
      console.error('List public courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading public courses',
        error: error.message
      });
    }
  },

  // View single course
  viewCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const course = await Course.findById(courseId);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Check if user is enrolled (for students) or is instructor/admin
      let isEnrolled = false;
      if (req.user.role_name === ROLES.STUDENT) {
        const enrollment = await db.query(
          'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? AND status = "active"',
          [courseId, req.user.id]
        );
        isEnrolled = enrollment.length > 0;
      }

      const canAccess = [ROLES.ADMIN, ROLES.INSTRUCTOR].includes(req.user.role_name) || isEnrolled;

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this course'
        });
      }

      res.json({
        success: true,
        data: course
      });
    } catch (error) {
      console.error('View course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course',
        error: error.message
      });
    }
  },

  // View public course (no authentication required)
  viewPublicCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const course = await Course.getPublicCourse(courseId);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found or not publicly available'
        });
      }

      res.json({
        success: true,
        data: course
      });
    } catch (error) {
      console.error('View public course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading public course',
        error: error.message
      });
    }
  },

  // Available courses for enrollment
  availableCourses: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 12;

      const coursesData = await Course.getAvailableCourses(req.user.id, page, limit);

      res.json({
        success: true,
        data: {
          courses: coursesData.courses,
          pagination: {
            current: page,
            pages: coursesData.totalPages,
            total: coursesData.total
          }
        }
      });
    } catch (error) {
      console.error('Available courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading available courses',
        error: error.message
      });
    }
  },

  // Enroll in course
  enrollInCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;

      // Check if already enrolled
      const existingEnrollment = await db.query(
        'SELECT id FROM enrollments WHERE course_id = ? AND student_id = ?',
        [courseId, studentId]
      );

      if (existingEnrollment.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'You are already enrolled in this course'
        });
      }

      // Create enrollment
      await db.query(
        'INSERT INTO enrollments (course_id, student_id, enrolled_at, status) VALUES (?, ?, NOW(), "active")',
        [courseId, studentId]
      );

      res.json({
        success: true,
        message: 'Successfully enrolled in course'
      });
    } catch (error) {
      console.error('Enroll in course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error enrolling in course',
        error: error.message
      });
    }
  },

  // Drop course
  dropCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;

      await db.query(
        'UPDATE enrollments SET status = "dropped", dropped_at = NOW() WHERE course_id = ? AND student_id = ?',
        [courseId, studentId]
      );

      res.json({
        success: true,
        message: 'Successfully dropped course'
      });
    } catch (error) {
      console.error('Drop course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error dropping course',
        error: error.message
      });
    }
  },

  // Create course (instructor/admin only)
  createCourse: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const courseData = req.body;

      const courseId = await Course.create(courseData, instructorId);

      res.json({
        success: true,
        message: 'Course created successfully',
        data: { courseId }
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating course',
        error: error.message
      });
    }
  },

  // Update course (instructor/admin only)
  updateCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const updateData = req.body;

      await Course.update(courseId, updateData);

      res.json({
        success: true,
        message: 'Course updated successfully'
      });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating course',
        error: error.message
      });
    }
  },

  // Delete course (instructor/admin only)
  deleteCourse: async (req, res) => {
    try {
      const courseId = req.params.courseId;

      await Course.delete(courseId);

      res.json({
        success: true,
        message: 'Course deleted successfully'
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting course',
        error: error.message
      });
    }
  },

  // Get course materials
  getCourseMaterials: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const materials = await Course.getMaterials(courseId);

      res.json({
        success: true,
        data: materials
      });
    } catch (error) {
      console.error('Get course materials error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course materials',
        error: error.message
      });
    }
  },

  // Download course material
  downloadMaterial: async (req, res) => {
    try {
      const { courseId, materialId } = req.params;
      const material = await Course.getMaterial(courseId, materialId);

      if (!material) {
        return res.status(404).json({
          success: false,
          message: 'Material not found'
        });
      }

      // In a real application, you would serve the file
      // For now, return the material info
      res.json({
        success: true,
        data: material
      });
    } catch (error) {
      console.error('Download material error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading material',
        error: error.message
      });
    }
  },

  // Upload course material (instructor/admin only)
  uploadMaterial: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const materialData = req.body;

      const materialId = await Course.addMaterial(courseId, materialData);

      res.json({
        success: true,
        message: 'Material uploaded successfully',
        data: { materialId }
      });
    } catch (error) {
      console.error('Upload material error:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading material',
        error: error.message
      });
    }
  },

  // Delete course material (instructor/admin only)
  deleteMaterial: async (req, res) => {
    try {
      const { courseId, materialId } = req.params;

      await Course.deleteMaterial(courseId, materialId);

      res.json({
        success: true,
        message: 'Material deleted successfully'
      });
    } catch (error) {
      console.error('Delete material error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting material',
        error: error.message
      });
    }
  },

  // Get course reviews
  getCourseReviews: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const reviews = await Course.getReviews(courseId);

      res.json({
        success: true,
        data: reviews
      });
    } catch (error) {
      console.error('Get course reviews error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course reviews',
        error: error.message
      });
    }
  },

  // Submit course review
  submitReview: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;
      const reviewData = req.body;

      const reviewId = await Course.addReview(courseId, studentId, reviewData);

      res.json({
        success: true,
        message: 'Review submitted successfully',
        data: { reviewId }
      });
    } catch (error) {
      console.error('Submit review error:', error);
      res.status(500).json({
        success: false,
        message: 'Error submitting review',
        error: error.message
      });
    }
  },

  // Get course announcements
  getAnnouncements: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const announcements = await Course.getAnnouncements(courseId);

      res.json({
        success: true,
        data: announcements
      });
    } catch (error) {
      console.error('Get announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading announcements',
        error: error.message
      });
    }
  },

  // Create announcement (instructor/admin only)
  createAnnouncement: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const instructorId = req.user.id;
      const announcementData = req.body;

      const announcementId = await Course.createAnnouncement(courseId, instructorId, announcementData);

      res.json({
        success: true,
        message: 'Announcement created successfully',
        data: { announcementId }
      });
    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating announcement',
        error: error.message
      });
    }
  },

  // Get course progress
  getCourseProgress: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;

      const progress = await Course.getProgress(courseId, studentId);

      res.json({
        success: true,
        data: progress
      });
    } catch (error) {
      console.error('Get course progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course progress',
        error: error.message
      });
    }
  },

  // Update course progress
  updateProgress: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;
      const progressData = req.body;

      await Course.updateProgress(courseId, studentId, progressData);

      res.json({
        success: true,
        message: 'Progress updated successfully'
      });
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating progress',
        error: error.message
      });
    }
  },

  // Search courses
  searchCourses: async (req, res) => {
    try {
      const query = req.params.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const results = await Course.search(query, page, limit);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Search courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching courses',
        error: error.message
      });
    }
  },

  // Get courses by category
  getCoursesByCategory: async (req, res) => {
    try {
      const categoryId = req.params.categoryId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const courses = await Course.getByCategory(categoryId, page, limit);

      res.json({
        success: true,
        data: courses
      });
    } catch (error) {
      console.error('Get courses by category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading courses by category',
        error: error.message
      });
    }
  },

  // Get courses by instructor
  getCoursesByInstructor: async (req, res) => {
    try {
      const instructorId = req.params.instructorId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const courses = await Course.getByInstructor(instructorId, page, limit);

      res.json({
        success: true,
        data: courses
      });
    } catch (error) {
      console.error('Get courses by instructor error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading courses by instructor',
        error: error.message
      });
    }
  },

  // Generate certificate
  generateCertificate: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;

      const certificate = await Course.generateCertificate(courseId, studentId);

      res.json({
        success: true,
        data: certificate
      });
    } catch (error) {
      console.error('Generate certificate error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating certificate',
        error: error.message
      });
    }
  },

  // Mark course as complete
  markCourseComplete: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const studentId = req.user.id;

      await Course.markComplete(courseId, studentId);

      res.json({
        success: true,
        message: 'Course marked as complete'
      });
    } catch (error) {
      console.error('Mark course complete error:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking course as complete',
        error: error.message
      });
    }
  }
};

module.exports = courseController;