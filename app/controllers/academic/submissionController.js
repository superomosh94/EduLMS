const Submission = require('../../models/Submission');
const Assignment = require('../../models/Assignment');
const Enrollment = require('../../models/Enrollment');
const { validationResult } = require('express-validator');
const { fileService } = require('../../services/fileService');

const submissionController = {
  // Submit assignment
  submitAssignment: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { assignmentId } = req.params;
      const { submissionText, draft = false } = req.body;

      // Verify assignment exists and is published
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      if (!assignment.isPublished) {
        return res.status(400).json({
          success: false,
          message: 'Assignment is not published'
        });
      }

      // Check if due date has passed
      if (new Date() > new Date(assignment.dueDate) && !draft) {
        return res.status(400).json({
          success: false,
          message: 'Assignment due date has passed'
        });
      }

      // Verify student is enrolled in the course
      const enrollment = await Enrollment.findOne({
        student: req.user.id,
        course: assignment.course,
        status: 'active'
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You are not enrolled in this course'
        });
      }

      // Check submission limit
      const existingSubmissions = await Submission.find({
        assignment: assignmentId,
        student: req.user.id
      });

      if (existingSubmissions.length >= assignment.allowedSubmissions && !draft) {
        return res.status(400).json({
          success: false,
          message: `Maximum submission limit (${assignment.allowedSubmissions}) reached`
        });
      }

      // Handle file submission
      let submissionFiles = [];
      if (req.files && req.files.length > 0) {
        submissionFiles = req.files.map(file => ({
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype
        }));
      }

      const submission = new Submission({
        assignment: assignmentId,
        student: req.user.id,
        submissionText: submissionText || '',
        files: submissionFiles,
        status: draft ? 'draft' : 'submitted',
        submittedAt: draft ? null : new Date(),
        attemptNumber: existingSubmissions.length + 1,
        isLate: draft ? false : new Date() > new Date(assignment.dueDate)
      });

      await submission.save();
      await submission.populate('assignment', 'title maxPoints dueDate');
      await submission.populate('student', 'firstName lastName studentId');

      res.status(201).json({
        success: true,
        message: `Assignment ${draft ? 'saved as draft' : 'submitted successfully'}`,
        data: submission
      });
    } catch (error) {
      console.error('Submit assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get submissions for assignment (instructor view)
  getAssignmentSubmissions: async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { 
        page = 1, 
        limit = 20, 
        status, 
        graded,
        lateOnly = false 
      } = req.query;

      // Verify assignment exists and user has access
      const assignment = await Assignment.findById(assignmentId)
        .populate('course', 'instructor');
      
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if user is instructor or admin
      if (assignment.course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can view submissions.'
        });
      }

      const filter = { assignment: assignmentId };
      
      if (status) filter.status = status;
      if (graded !== undefined) {
        filter.points = graded === 'true' ? { $ne: null } : null;
      }
      if (lateOnly === 'true') filter.isLate = true;

      const submissions = await Submission.find(filter)
        .populate('student', 'firstName lastName studentId email')
        .populate('gradedBy', 'firstName lastName')
        .sort({ submittedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Submission.countDocuments(filter);

      // Get submission statistics
      const stats = await Submission.aggregate([
        { $match: { assignment: assignment._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            averagePoints: { $avg: '$points' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          submissions,
          statistics: stats,
          assignment: {
            title: assignment.title,
            maxPoints: assignment.maxPoints,
            dueDate: assignment.dueDate
          },
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get assignment submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get student's submission
  getStudentSubmission: async (req, res) => {
    try {
      const { submissionId } = req.params;
      const studentId = req.user.role === 'student' ? req.user.id : req.query.studentId;

      const submission = await Submission.findById(submissionId)
        .populate('assignment', 'title maxPoints dueDate allowedSubmissions')
        .populate('student', 'firstName lastName studentId')
        .populate('gradedBy', 'firstName lastName');

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check permissions
      if (req.user.role === 'student' && submission.student._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.status(200).json({
        success: true,
        data: submission
      });
    } catch (error) {
      console.error('Get student submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update submission (for drafts)
  updateSubmission: async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { submissionText, draft = true } = req.body;

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check permissions
      if (submission.student.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if already graded
      if (submission.points !== null) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update graded submission'
        });
      }

      const assignment = await Assignment.findById(submission.assignment);
      
      // Handle file updates
      let updatedFiles = [...submission.files];
      if (req.files && req.files.length > 0) {
        // Delete old files if needed
        for (const file of submission.files) {
          await fileService.deleteFile(file.filePath);
        }
        
        updatedFiles = req.files.map(file => ({
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype
        }));
      }

      submission.submissionText = submissionText || submission.submissionText;
      submission.files = updatedFiles;
      submission.status = draft ? 'draft' : 'submitted';
      submission.submittedAt = draft ? null : new Date();
      submission.isLate = draft ? false : new Date() > new Date(assignment.dueDate);
      submission.updatedAt = new Date();

      await submission.save();

      res.status(200).json({
        success: true,
        message: `Submission ${draft ? 'updated' : 'submitted'} successfully`,
        data: submission
      });
    } catch (error) {
      console.error('Update submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Delete submission
  deleteSubmission: async (req, res) => {
    try {
      const { submissionId } = req.params;

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check permissions
      if (submission.student.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if already graded
      if (submission.points !== null) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete graded submission'
        });
      }

      // Delete files
      if (submission.files && submission.files.length > 0) {
        for (const file of submission.files) {
          await fileService.deleteFile(file.filePath);
        }
      }

      await Submission.findByIdAndDelete(submissionId);

      res.status(200).json({
        success: true,
        message: 'Submission deleted successfully'
      });
    } catch (error) {
      console.error('Delete submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Download submission file
  downloadSubmissionFile: async (req, res) => {
    try {
      const { submissionId, fileId } = req.params;

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      const file = submission.files.id(fileId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check permissions
      const assignment = await Assignment.findById(submission.assignment).populate('course');
      if (req.user.role === 'student' && 
          submission.student.toString() !== req.user.id && 
          assignment.course.instructor.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const fileStream = await fileService.downloadFile(file.filePath);
      
      res.set({
        'Content-Type': file.mimeType,
        'Content-Disposition': `attachment; filename="${file.fileName}"`,
        'Content-Length': file.fileSize
      });

      fileStream.pipe(res);
    } catch (error) {
      console.error('Download submission file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get submission history for student
  getSubmissionHistory: async (req, res) => {
    try {
      const { assignmentId, studentId } = req.params;
      const targetStudentId = studentId || req.user.id;

      const submissions = await Submission.find({
        assignment: assignmentId,
        student: targetStudentId
      })
        .populate('assignment', 'title maxPoints')
        .populate('gradedBy', 'firstName lastName')
        .sort({ attemptNumber: 1 });

      res.status(200).json({
        success: true,
        data: submissions
      });
    } catch (error) {
      console.error('Get submission history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get student's own submissions
  getMySubmissions: async (req, res) => {
    try {
      const studentId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      
      const filter = { student: studentId };
      if (status) filter.status = status;

      const submissions = await Submission.find(filter)
        .populate('assignment', 'title course dueDate')
        .populate({
          path: 'assignment',
          populate: { path: 'course', select: 'name code' }
        })
        .sort({ submittedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Submission.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          submissions,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get my submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading submissions',
        error: error.message
      });
    }
  },

  // Grade submission (instructor only)
  gradeSubmission: async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { points, feedback, gradedBy } = req.body;

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      submission.points = points;
      submission.feedback = feedback;
      submission.gradedBy = gradedBy || req.user.id;
      submission.gradedAt = new Date();
      submission.status = 'graded';

      await submission.save();

      res.status(200).json({
        success: true,
        message: 'Submission graded successfully',
        data: submission
      });
    } catch (error) {
      console.error('Grade submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Error grading submission',
        error: error.message
      });
    }
  },

  // Get course submissions (instructor only)
  getCourseSubmissions: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Get all assignments for the course
      const assignments = await Assignment.find({ course: courseId });
      const assignmentIds = assignments.map(a => a._id);

      const submissions = await Submission.find({ 
        assignment: { $in: assignmentIds } 
      })
        .populate('assignment', 'title dueDate')
        .populate('student', 'firstName lastName studentId')
        .sort({ submittedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Submission.countDocuments({ 
        assignment: { $in: assignmentIds } 
      });

      res.status(200).json({
        success: true,
        data: {
          submissions,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get course submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course submissions',
        error: error.message
      });
    }
  }
};

module.exports = submissionController;