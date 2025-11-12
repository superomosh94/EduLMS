const db = require('../../../config/database');
const Assignment = require('../../models/Assignment');
const { ROLES } = require('../../../config/constants');

const assignmentController = {
  // List all assignments (with pagination and filtering)
  listAssignments: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const courseId = req.query.courseId || '';
      const status = req.query.status || '';
      const type = req.query.type || '';
      const search = req.query.search || '';

      const filters = {};
      if (courseId) filters.course_id = courseId;
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (search) filters.search = search;

      const assignmentsData = await Assignment.getAssignments(filters, page, limit);

      res.json({
        success: true,
        data: {
          assignments: assignmentsData.assignments,
          pagination: {
            current: page,
            pages: assignmentsData.totalPages,
            total: assignmentsData.total
          }
        }
      });
    } catch (error) {
      console.error('List assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading assignments',
        error: error.message
      });
    }
  },

  // Get assignments for a specific course
  getCourseAssignments: async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const assignmentsData = await Assignment.getByCourse(courseId, page, limit);

      res.json({
        success: true,
        data: {
          assignments: assignmentsData.assignments,
          pagination: {
            current: page,
            pages: assignmentsData.totalPages,
            total: assignmentsData.total
          }
        }
      });
    } catch (error) {
      console.error('Get course assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading course assignments',
        error: error.message
      });
    }
  },

  // View single assignment
  viewAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const assignment = await Assignment.findById(assignmentId);

      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      // Check if user has access to this assignment
      const hasAccess = await Assignment.checkAccess(assignmentId, req.user.id, req.user.role_name);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this assignment'
        });
      }

      res.json({
        success: true,
        data: assignment
      });
    } catch (error) {
      console.error('View assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading assignment',
        error: error.message
      });
    }
  },

  // Submit assignment (student only)
  submitAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const studentId = req.user.id;
      const submissionData = req.body;

      // Check if assignment exists and is active
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment || assignment.status !== 'published') {
        return res.status(400).json({
          success: false,
          message: 'Assignment not available for submission'
        });
      }

      // Check if due date has passed
      if (new Date(assignment.due_date) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Assignment submission deadline has passed'
        });
      }

      // Check if already submitted
      const existingSubmission = await db.query(
        'SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?',
        [assignmentId, studentId]
      );

      if (existingSubmission.length > 0 && !assignment.allow_multiple_attempts) {
        return res.status(400).json({
          success: false,
          message: 'You have already submitted this assignment'
        });
      }

      const submissionId = await Assignment.submit(assignmentId, studentId, submissionData);

      res.json({
        success: true,
        message: 'Assignment submitted successfully',
        data: { submissionId }
      });
    } catch (error) {
      console.error('Submit assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error submitting assignment',
        error: error.message
      });
    }
  },

  // View submission
  viewSubmission: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const submission = await Assignment.getSubmission(submissionId);

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Check if user has access to view this submission
      const canView = await Assignment.canViewSubmission(submissionId, req.user.id, req.user.role_name);

      if (!canView) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this submission'
        });
      }

      res.json({
        success: true,
        data: submission
      });
    } catch (error) {
      console.error('View submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading submission',
        error: error.message
      });
    }
  },

  // Update submission (student only)
  updateSubmission: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const studentId = req.user.id;
      const updateData = req.body;

      // Check if submission belongs to student
      const submission = await db.query(
        'SELECT * FROM assignment_submissions WHERE id = ? AND student_id = ?',
        [submissionId, studentId]
      );

      if (submission.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own submissions'
        });
      }

      // Check if assignment allows updates
      const assignment = await Assignment.findById(submission[0].assignment_id);
      if (!assignment.allow_updates) {
        return res.status(400).json({
          success: false,
          message: 'This assignment does not allow submission updates'
        });
      }

      await Assignment.updateSubmission(submissionId, updateData);

      res.json({
        success: true,
        message: 'Submission updated successfully'
      });
    } catch (error) {
      console.error('Update submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating submission',
        error: error.message
      });
    }
  },

  // Delete submission (student only)
  deleteSubmission: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const studentId = req.user.id;

      // Check if submission belongs to student
      const submission = await db.query(
        'SELECT * FROM assignment_submissions WHERE id = ? AND student_id = ?',
        [submissionId, studentId]
      );

      if (submission.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own submissions'
        });
      }

      await Assignment.deleteSubmission(submissionId);

      res.json({
        success: true,
        message: 'Submission deleted successfully'
      });
    } catch (error) {
      console.error('Delete submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting submission',
        error: error.message
      });
    }
  },

  // Create assignment (instructor/admin only)
  createAssignment: async (req, res) => {
    try {
      const instructorId = req.user.id;
      const assignmentData = req.body;

      const assignmentId = await Assignment.create(assignmentData, instructorId);

      res.json({
        success: true,
        message: 'Assignment created successfully',
        data: { assignmentId }
      });
    } catch (error) {
      console.error('Create assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating assignment',
        error: error.message
      });
    }
  },

  // Update assignment (instructor/admin only)
  updateAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const updateData = req.body;

      await Assignment.update(assignmentId, updateData);

      res.json({
        success: true,
        message: 'Assignment updated successfully'
      });
    } catch (error) {
      console.error('Update assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating assignment',
        error: error.message
      });
    }
  },

  // Delete assignment (instructor/admin only)
  deleteAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;

      await Assignment.delete(assignmentId);

      res.json({
        success: true,
        message: 'Assignment deleted successfully'
      });
    } catch (error) {
      console.error('Delete assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting assignment',
        error: error.message
      });
    }
  },

  // Publish assignment (instructor/admin only)
  publishAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;

      await Assignment.publish(assignmentId);

      res.json({
        success: true,
        message: 'Assignment published successfully'
      });
    } catch (error) {
      console.error('Publish assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error publishing assignment',
        error: error.message
      });
    }
  },

  // Unpublish assignment (instructor/admin only)
  unpublishAssignment: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;

      await Assignment.unpublish(assignmentId);

      res.json({
        success: true,
        message: 'Assignment unpublished successfully'
      });
    } catch (error) {
      console.error('Unpublish assignment error:', error);
      res.status(500).json({
        success: false,
        message: 'Error unpublishing assignment',
        error: error.message
      });
    }
  },

  // Get submissions for an assignment (instructor/admin only)
  getSubmissions: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.page) || 20;
      const status = req.query.status || '';

      const submissionsData = await Assignment.getSubmissions(assignmentId, page, limit, status);

      res.json({
        success: true,
        data: {
          submissions: submissionsData.submissions,
          pagination: {
            current: page,
            pages: submissionsData.totalPages,
            total: submissionsData.total
          }
        }
      });
    } catch (error) {
      console.error('Get submissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading submissions',
        error: error.message
      });
    }
  },

  // Grade submission (instructor/admin only)
  gradeSubmission: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const gradeData = req.body;

      await Assignment.gradeSubmission(submissionId, gradeData);

      res.json({
        success: true,
        message: 'Submission graded successfully'
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

  // Download assignment files (instructor/admin only)
  downloadAssignmentFiles: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const files = await Assignment.getFiles(assignmentId);

      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Download assignment files error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading assignment files',
        error: error.message
      });
    }
  },

  // Download submission file
  downloadSubmissionFile: async (req, res) => {
    try {
      const submissionId = req.params.submissionId;
      const file = await Assignment.getSubmissionFile(submissionId);

      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.json({
        success: true,
        data: file
      });
    } catch (error) {
      console.error('Download submission file error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading submission file',
        error: error.message
      });
    }
  },

  // Get assignment analytics (instructor/admin only)
  getAssignmentAnalytics: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const analytics = await Assignment.getAnalytics(assignmentId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get assignment analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading assignment analytics',
        error: error.message
      });
    }
  },
  // Add these methods to your submissionController if needed:

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

    res.json({
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

    res.json({
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

    res.json({
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
},

  // Get assignment statistics (instructor/admin only)
  getAssignmentStatistics: async (req, res) => {
    try {
      const assignmentId = req.params.assignmentId;
      const statistics = await Assignment.getStatistics(assignmentId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get assignment statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Error loading assignment statistics',
        error: error.message
      });
    }
  }
};

module.exports = assignmentController;