const Course = require('../../models/Course');
const Enrollment = require('../../models/Enrollment');
const User = require('../../models/User');
const { validationResult } = require('express-validator');
const { fileService } = require('../../services/fileService');

const courseController = {
  // Create new course
  createCourse: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        courseCode,
        courseName,
        description,
        credits,
        department,
        program,
        semester,
        academicYear,
        maxStudents,
        prerequisites,
        learningObjectives,
        instructorId
      } = req.body;

      // Check if course code already exists
      const existingCourse = await Course.findOne({ courseCode });
      if (existingCourse) {
        return res.status(400).json({
          success: false,
          message: 'Course code already exists'
        });
      }

      const course = new Course({
        courseCode,
        courseName,
        description,
        credits,
        department,
        program,
        semester,
        academicYear,
        maxStudents,
        prerequisites: prerequisites || [],
        learningObjectives: learningObjectives || [],
        instructor: instructorId,
        createdBy: req.user.id
      });

      await course.save();

      // Populate the instructor details
      await course.populate('instructor', 'firstName lastName email');
      await course.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: course
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get all courses
  getCourses: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        department,
        program,
        semester,
        academicYear,
        instructorId,
        status = 'active'
      } = req.query;

      const filter = { status };
      
      if (department) filter.department = department;
      if (program) filter.program = program;
      if (semester) filter.semester = semester;
      if (academicYear) filter.academicYear = academicYear;
      if (instructorId) filter.instructor = instructorId;

      const courses = await Course.find(filter)
        .populate('instructor', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Course.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          courses,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get course by ID
  getCourse: async (req, res) => {
    try {
      const { id } = req.params;

      const course = await Course.findById(id)
        .populate('instructor', 'firstName lastName email phone')
        .populate('createdBy', 'firstName lastName')
        .populate('prerequisites', 'courseCode courseName credits');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Get enrollment count
      const enrollmentCount = await Enrollment.countDocuments({
        course: id,
        status: 'active'
      });

      // Get course materials count
      const materialsCount = course.materials ? course.materials.length : 0;

      res.status(200).json({
        success: true,
        data: {
          ...course.toObject(),
          enrollmentCount,
          materialsCount
        }
      });
    } catch (error) {
      console.error('Get course error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update course
  updateCourse: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      const course = await Course.findByIdAndUpdate(
        id,
        { ...updateData, updatedBy: req.user.id },
        { new: true, runValidators: true }
      )
        .populate('instructor', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName');

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Course updated successfully',
        data: course
      });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Delete course
  deleteCourse: async (req, res) => {
    try {
      const { id } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Check if course has active enrollments
      const activeEnrollments = await Enrollment.countDocuments({
        course: id,
        status: 'active'
      });

      if (activeEnrollments > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete course with active enrollments'
        });
      }

      await Course.findByIdAndUpdate(id, { 
        status: 'archived',
        updatedBy: req.user.id 
      });

      res.status(200).json({
        success: true,
        message: 'Course archived successfully'
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Add course material
  addCourseMaterial: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, type } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File is required'
        });
      }

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const material = {
        title,
        description,
        type: type || 'document',
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: req.user.id,
        uploadedAt: new Date()
      };

      course.materials.push(material);
      await course.save();

      res.status(201).json({
        success: true,
        message: 'Course material added successfully',
        data: material
      });
    } catch (error) {
      console.error('Add course material error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Remove course material
  removeCourseMaterial: async (req, res) => {
    try {
      const { id, materialId } = req.params;

      const course = await Course.findById(id);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const material = course.materials.id(materialId);
      if (!material) {
        return res.status(404).json({
          success: false,
          message: 'Course material not found'
        });
      }

      // Delete file from storage
      await fileService.deleteFile(material.filePath);

      course.materials.pull(materialId);
      await course.save();

      res.status(200).json({
        success: true,
        message: 'Course material removed successfully'
      });
    } catch (error) {
      console.error('Remove course material error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get course statistics
  getCourseStats: async (req, res) => {
    try {
      const { academicYear, semester } = req.query;
      const filter = {};

      if (academicYear) filter.academicYear = academicYear;
      if (semester) filter.semester = semester;

      const stats = await Course.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$department',
            totalCourses: { $sum: 1 },
            totalCredits: { $sum: '$credits' },
            averageCredits: { $avg: '$credits' }
          }
        }
      ]);

      const enrollmentStats = await Enrollment.aggregate([
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
            }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          departmentStats: stats,
          enrollmentStats
        }
      });
    } catch (error) {
      console.error('Get course stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Search courses
  searchCourses: async (req, res) => {
    try {
      const { q, department, program, page = 1, limit = 10 } = req.query;

      const filter = { status: 'active' };
      
      if (department) filter.department = department;
      if (program) filter.program = program;

      if (q) {
        filter.$or = [
          { courseCode: { $regex: q, $options: 'i' } },
          { courseName: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }

      const courses = await Course.find(filter)
        .populate('instructor', 'firstName lastName email')
        .sort({ courseCode: 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Course.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          courses,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Search courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = courseController;