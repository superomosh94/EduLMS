const Assignment = require('../../models/Assignment');
const Course = require('../../models/Course');
const Submission = require('../../models/Submission');
const { validationResult } = require('express-validator');
const { fileService } = require('../../services/fileService');

const assignmentController = {
  // Create assignment
  createAssignment: async (req, res) => {
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
        courseId,
        title,
        description,
        dueDate,
        maxPoints,
        assignmentType,
        instructions,
        allowedSubmissions,
        gradingCriteria,
        isPublished = false
      } = req.body;

      // Verify course exists and user is instructor
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Check if user is the course instructor
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can create assignments.'
        });
      }

      const assignment = new Assignment({
        course: courseId,
        title,
        description,
        dueDate,
        maxPoints,
        assignmentType: assignmentType || 'homework',
        instructions,
        allowedSubmissions: allowedSubmissions || 1,
        gradingCriteria: gradingCriteria || [],
        isPublished,
        createdBy: req.user.id
      });

      // Handle file attachments
      if (req.files && req.files.length > 0) {
        assignment.attachments = req.files.map(file => ({
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: req.user.id
        }));
      }

      await assignment.save();
      await assignment.populate('course', 'courseCode courseName');
      await assignment.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully',
        data: assignment
      });
    } catch (error) {
      console.error('Create assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get assignments for course
  getCourseAssignments: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { 
        page = 1, 
        limit = 10, 
        assignmentType, 
        isPublished,
        includeSubmissions = false 
      } = req.query;

      const filter = { course: courseId };

      if (assignmentType) filter.assignmentType = assignmentType;
      if (isPublished !== undefined) filter.isPublished = isPublished === 'true';

      const assignments = await Assignment.find(filter)
        .populate('course', 'courseCode courseName')
        .populate('createdBy', 'firstName lastName')
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // If requested, include submission status for current user
      let assignmentsWithStatus = assignments;
      if (includeSubmissions === 'true' && req.user.role === 'student') {
        assignmentsWithStatus = await Promise.all(
          assignments.map(async (assignment) => {
            const submission = await Submission.findOne({
              assignment: assignment._id,
              student: req.user.id
            });
            
            const assignmentObj = assignment.toObject();
            assignmentObj.submissionStatus = submission ? submission.status : 'not_submitted';
            assignmentObj.submittedAt = submission ? submission.submittedAt : null;
            
            return assignmentObj;
          })
        );
      }

      const total = await Assignment.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          assignments: assignmentsWithStatus,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get course assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get assignment by ID
  getAssignment: async (req, res) => {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id)
        .populate('course', 'courseCode courseName instructor')
        .populate('createdBy', 'firstName lastName');

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // For students, check if they can view (only published assignments)
      if (req.user.role === 'student' && !assignment.isPublished) {
        return res.status(403).json({
          success: false,
          message: 'This assignment is not published yet'
        });
      }

      res.status(200).json({
        success: true,
        data: assignment
      });
    } catch (error) {
      console.error('Get assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update assignment
  updateAssignment: async (req, res) => {
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

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check permissions
      const course = await Course.findById(assignment.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can update assignments.'
        });
      }

      // Handle file attachments
      if (req.files && req.files.length > 0) {
        const newAttachments = req.files.map(file => ({
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: req.user.id
        }));
        
        updateData.attachments = [...assignment.attachments, ...newAttachments];
      }

      const updatedAssignment = await Assignment.findByIdAndUpdate(
        id,
        { ...updateData, updatedBy: req.user.id },
        { new: true, runValidators: true }
      )
        .populate('course', 'courseCode courseName')
        .populate('createdBy', 'firstName lastName');

      res.status(200).json({
        success: true,
        message: 'Assignment updated successfully',
        data: updatedAssignment
      });
    } catch (error) {
      console.error('Update assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Delete assignment
  deleteAssignment: async (req, res) => {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check permissions
      const course = await Course.findById(assignment.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can delete assignments.'
        });
      }

      // Check if there are submissions
      const submissionCount = await Submission.countDocuments({ assignment: id });
      if (submissionCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete assignment with existing submissions'
        });
      }

      // Delete attachment files
      if (assignment.attachments && assignment.attachments.length > 0) {
        for (const attachment of assignment.attachments) {
          await fileService.deleteFile(attachment.filePath);
        }
      }

      await Assignment.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Assignment deleted successfully'
      });
    } catch (error) {
      console.error('Delete assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Publish/unpublish assignment
  togglePublish: async (req, res) => {
    try {
      const { id } = req.params;
      const { isPublished } = req.body;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check permissions
      const course = await Course.findById(assignment.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can publish assignments.'
        });
      }

      assignment.isPublished = isPublished;
      assignment.updatedBy = req.user.id;
      await assignment.save();

      res.status(200).json({
        success: true,
        message: `Assignment ${isPublished ? 'published' : 'unpublished'} successfully`,
        data: assignment
      });
    } catch (error) {
      console.error('Toggle publish error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get assignment statistics
  getAssignmentStats: async (req, res) => {
    try {
      const { id } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const stats = await Submission.aggregate([
        { $match: { assignment: assignment._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            averageScore: { $avg: '$points' }
          }
        }
      ]);

      const gradeDistribution = await Submission.aggregate([
        { $match: { assignment: assignment._id, points: { $ne: null } } },
        {
          $bucket: {
            groupBy: '$points',
            boundaries: [0, 50, 60, 70, 80, 90, 101],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              students: { $push: '$student' }
            }
          }
        }
      ]);

      const totalEnrollments = await require('../../models/Enrollment').countDocuments({
        course: assignment.course,
        status: 'active'
      });

      res.status(200).json({
        success: true,
        data: {
          assignment: assignment.title,
          totalEnrollments,
          submissionStats: stats,
          gradeDistribution,
          dueDate: assignment.dueDate,
          maxPoints: assignment.maxPoints
        }
      });
    } catch (error) {
      console.error('Get assignment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Remove assignment attachment
  removeAttachment: async (req, res) => {
    try {
      const { id, attachmentId } = req.params;

      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const attachment = assignment.attachments.id(attachmentId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'Attachment not found'
        });
      }

      // Delete file from storage
      await fileService.deleteFile(attachment.filePath);

      assignment.attachments.pull(attachmentId);
      await assignment.save();

      res.status(200).json({
        success: true,
        message: 'Attachment removed successfully'
      });
    } catch (error) {
      console.error('Remove attachment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = assignmentController;