const Grade = require('../../models/Grade');
const Submission = require('../../models/Submission');
const Assignment = require('../../models/Assignment');
const Course = require('../../models/Course');
const Enrollment = require('../../models/Enrollment');
const { validationResult } = require('express-validator');

const gradeController = {
  // Grade submission
  gradeSubmission: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { submissionId } = req.params;
      const { points, feedback, comments, rubricScores } = req.body;

      const submission = await Submission.findById(submissionId)
        .populate('assignment')
        .populate('student', 'firstName lastName studentId');

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: 'Submission not found'
        });
      }

      // Verify user is instructor of the course
      const course = await Course.findById(submission.assignment.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only course instructor can grade submissions.'
        });
      }

      // Validate points
      if (points > submission.assignment.maxPoints) {
        return res.status(400).json({
          success: false,
          message: `Points cannot exceed maximum points (${submission.assignment.maxPoints})`
        });
      }

      // Update submission with grade
      submission.points = points;
      submission.feedback = feedback;
      submission.comments = comments;
      submission.rubricScores = rubricScores || [];
      submission.gradedBy = req.user.id;
      submission.gradedAt = new Date();
      submission.status = 'graded';

      await submission.save();

      // Update or create grade record
      let grade = await Grade.findOne({
        student: submission.student._id,
        course: course._id
      });

      if (!grade) {
        grade = new Grade({
          student: submission.student._id,
          course: course._id,
          assignmentGrades: []
        });
      }

      // Update assignment grade
      const assignmentGradeIndex = grade.assignmentGrades.findIndex(
        ag => ag.assignment.toString() === submission.assignment._id.toString()
      );

      if (assignmentGradeIndex > -1) {
        grade.assignmentGrades[assignmentGradeIndex] = {
          assignment: submission.assignment._id,
          points: points,
          maxPoints: submission.assignment.maxPoints,
          gradedAt: new Date()
        };
      } else {
        grade.assignmentGrades.push({
          assignment: submission.assignment._id,
          points: points,
          maxPoints: submission.assignment.maxPoints,
          gradedAt: new Date()
        });
      }

      // Recalculate overall grade
      await calculateOverallGrade(grade);

      await grade.save();

      res.status(200).json({
        success: true,
        message: 'Submission graded successfully',
        data: {
          submission,
          grade: grade.overallGrade
        }
      });
    } catch (error) {
      console.error('Grade submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Bulk grade submissions
  bulkGradeSubmissions: async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { grades } = req.body;

      if (!grades || !Array.isArray(grades)) {
        return res.status(400).json({
          success: false,
          message: 'Grades array is required'
        });
      }

      // Verify assignment and permissions
      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found'
        });
      }

      const course = await Course.findById(assignment.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const results = {
        successful: [],
        failed: []
      };

      for (const gradeData of grades) {
        try {
          const { submissionId, points, feedback, comments } = gradeData;

          const submission = await Submission.findById(submissionId);
          if (!submission) {
            results.failed.push({
              submissionId,
              error: 'Submission not found'
            });
            continue;
          }

          if (points > assignment.maxPoints) {
            results.failed.push({
              submissionId,
              error: `Points exceed maximum (${assignment.maxPoints})`
            });
            continue;
          }

          submission.points = points;
          submission.feedback = feedback;
          submission.comments = comments;
          submission.gradedBy = req.user.id;
          submission.gradedAt = new Date();
          submission.status = 'graded';

          await submission.save();

          // Update grade record
          await updateStudentGrade(submission.student, course._id, assignment._id, points, assignment.maxPoints);

          results.successful.push(submissionId);
        } catch (error) {
          results.failed.push({
            submissionId: gradeData.submissionId,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk grading completed. Successful: ${results.successful.length}, Failed: ${results.failed.length}`,
        data: results
      });
    } catch (error) {
      console.error('Bulk grade error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get grades for course
  getCourseGrades: async (req, res) => {
    try {
      const { courseId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Verify course and permissions
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      // Students can only see their own grades
      if (req.user.role === 'student') {
        const grade = await Grade.findOne({
          student: req.user.id,
          course: courseId
        })
          .populate('student', 'firstName lastName studentId')
          .populate('assignmentGrades.assignment', 'title maxPoints assignmentType');

        if (!grade) {
          return res.status(404).json({
            success: false,
            message: 'No grades found'
          });
        }

        return res.status(200).json({
          success: true,
          data: grade
        });
      }

      // Instructors and admins can see all grades
      const grades = await Grade.find({ course: courseId })
        .populate('student', 'firstName lastName studentId email')
        .populate('assignmentGrades.assignment', 'title maxPoints assignmentType dueDate')
        .sort({ 'student.lastName': 1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Grade.countDocuments({ course: courseId });

      res.status(200).json({
        success: true,
        data: {
          grades,
          course: {
            name: course.courseName,
            code: course.courseCode
          },
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get course grades error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get student gradebook
  getStudentGradebook: async (req, res) => {
    try {
      const studentId = req.user.role === 'student' ? req.user.id : req.params.studentId;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      // Check permissions
      if (req.user.role === 'student' && studentId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const grades = await Grade.find({ student: studentId })
        .populate('course', 'courseCode courseName credits instructor')
        .populate('assignmentGrades.assignment', 'title maxPoints assignmentType dueDate')
        .populate({
          path: 'course',
          populate: { path: 'instructor', select: 'firstName lastName' }
        });

      // Calculate overall GPA
      const overallStats = calculateOverallStats(grades);

      res.status(200).json({
        success: true,
        data: {
          grades,
          overallStats,
          student: grades[0]?.student || studentId
        }
      });
    } catch (error) {
      console.error('Get student gradebook error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update grade
  updateGrade: async (req, res) => {
    try {
      const { gradeId, assignmentId } = req.params;
      const { points, feedback } = req.body;

      const grade = await Grade.findById(gradeId);
      if (!grade) {
        return res.status(404).json({
          success: false,
          message: 'Grade record not found'
        });
      }

      // Verify permissions
      const course = await Course.findById(grade.course);
      if (course.instructor.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const assignmentGradeIndex = grade.assignmentGrades.findIndex(
        ag => ag.assignment.toString() === assignmentId
      );

      if (assignmentGradeIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Assignment grade not found'
        });
      }

      // Get assignment for max points validation
      const assignment = await Assignment.findById(assignmentId);
      if (points > assignment.maxPoints) {
        return res.status(400).json({
          success: false,
          message: `Points cannot exceed maximum points (${assignment.maxPoints})`
        });
      }

      grade.assignmentGrades[assignmentGradeIndex].points = points;
      grade.assignmentGrades[assignmentGradeIndex].feedback = feedback;
      grade.assignmentGrades[assignmentGradeIndex].updatedAt = new Date();

      // Recalculate overall grade
      await calculateOverallGrade(grade);

      await grade.save();

      // Update corresponding submission
      await Submission.findOneAndUpdate(
        {
          student: grade.student,
          assignment: assignmentId
        },
        {
          points: points,
          feedback: feedback,
          gradedBy: req.user.id,
          gradedAt: new Date()
        }
      );

      res.status(200).json({
        success: true,
        message: 'Grade updated successfully',
        data: grade
      });
    } catch (error) {
      console.error('Update grade error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get grade statistics for course
  getGradeStatistics: async (req, res) => {
    try {
      const { courseId } = req.params;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const grades = await Grade.find({ course: courseId });

      if (grades.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No grades found for this course'
        });
      }

      const statistics = calculateCourseStatistics(grades, course);

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get grade statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Export grades
  exportGrades: async (req, res) => {
    try {
      const { courseId, format = 'csv' } = req.params;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      const grades = await Grade.find({ course: courseId })
        .populate('student', 'firstName lastName studentId')
        .populate('assignmentGrades.assignment', 'title maxPoints');

      if (format === 'csv') {
        const csvData = convertGradesToCSV(grades, course);
        
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=grades-${course.courseCode}-${new Date().toISOString().split('T')[0]}.csv`
        });

        return res.send(csvData);
      }

      res.status(200).json({
        success: true,
        data: grades
      });
    } catch (error) {
      console.error('Export grades error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

// Helper functions
async function calculateOverallGrade(grade) {
  const assignments = await Assignment.find({
    _id: { $in: grade.assignmentGrades.map(ag => ag.assignment) }
  });

  let totalWeightedPoints = 0;
  let totalMaxPoints = 0;

  grade.assignmentGrades.forEach(ag => {
    const assignment = assignments.find(a => a._id.toString() === ag.assignment.toString());
    if (assignment && ag.points !== null) {
      totalWeightedPoints += ag.points;
      totalMaxPoints += assignment.maxPoints;
    }
  });

  grade.overallGrade = totalMaxPoints > 0 ? (totalWeightedPoints / totalMaxPoints) * 100 : 0;
  grade.letterGrade = calculateLetterGrade(grade.overallGrade);
  grade.updatedAt = new Date();
}

function calculateLetterGrade(percentage) {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function calculateOverallStats(grades) {
  let totalCredits = 0;
  let totalGradePoints = 0;

  grades.forEach(grade => {
    const course = grade.course;
    if (grade.overallGrade !== null) {
      const gradePoint = calculateGradePoint(grade.letterGrade);
      totalGradePoints += gradePoint * course.credits;
      totalCredits += course.credits;
    }
  });

  return {
    gpa: totalCredits > 0 ? totalGradePoints / totalCredits : 0,
    totalCredits,
    totalCourses: grades.length
  };
}

function calculateGradePoint(letterGrade) {
  const gradePoints = {
    'A': 4.0,
    'B': 3.0,
    'C': 2.0,
    'D': 1.0,
    'F': 0.0
  };
  return gradePoints[letterGrade] || 0;
}

function calculateCourseStatistics(grades, course) {
  const overallGrades = grades.map(g => g.overallGrade).filter(g => g !== null);
  
  if (overallGrades.length === 0) {
    return {
      course: course.courseName,
      totalStudents: grades.length,
      message: 'No graded students'
    };
  }

  const average = overallGrades.reduce((a, b) => a + b, 0) / overallGrades.length;
  const max = Math.max(...overallGrades);
  const min = Math.min(...overallGrades);

  // Grade distribution
  const distribution = {
    A: overallGrades.filter(g => g >= 90).length,
    B: overallGrades.filter(g => g >= 80 && g < 90).length,
    C: overallGrades.filter(g => g >= 70 && g < 80).length,
    D: overallGrades.filter(g => g >= 60 && g < 70).length,
    F: overallGrades.filter(g => g < 60).length
  };

  return {
    course: course.courseName,
    totalStudents: grades.length,
    gradedStudents: overallGrades.length,
    averageGrade: Math.round(average * 100) / 100,
    highestGrade: Math.round(max * 100) / 100,
    lowestGrade: Math.round(min * 100) / 100,
    gradeDistribution: distribution
  };
}

function convertGradesToCSV(grades, course) {
  const headers = ['Student ID', 'Name', 'Overall Grade', 'Letter Grade'];
  
  // Get all assignment titles
  const assignmentTitles = [];
  if (grades.length > 0 && grades[0].assignmentGrades.length > 0) {
    grades[0].assignmentGrades.forEach(ag => {
      assignmentTitles.push(ag.assignment.title);
    });
  }

  const allHeaders = [...headers, ...assignmentTitles];
  const csvRows = [allHeaders];

  grades.forEach(grade => {
    const row = [
      grade.student.studentId,
      `${grade.student.firstName} ${grade.student.lastName}`,
      grade.overallGrade ? Math.round(grade.overallGrade * 100) / 100 : '',
      grade.letterGrade || ''
    ];

    // Add assignment grades
    grade.assignmentGrades.forEach(ag => {
      row.push(ag.points !== null ? ag.points : '');
    });

    csvRows.push(row);
  });

  return csvRows.map(row => row.join(',')).join('\n');
}

async function updateStudentGrade(studentId, courseId, assignmentId, points, maxPoints) {
  let grade = await Grade.findOne({ student: studentId, course: courseId });

  if (!grade) {
    grade = new Grade({
      student: studentId,
      course: courseId,
      assignmentGrades: []
    });
  }

  const assignmentGradeIndex = grade.assignmentGrades.findIndex(
    ag => ag.assignment.toString() === assignmentId.toString()
  );

  if (assignmentGradeIndex > -1) {
    grade.assignmentGrades[assignmentGradeIndex].points = points;
    grade.assignmentGrades[assignmentGradeIndex].maxPoints = maxPoints;
    grade.assignmentGrades[assignmentGradeIndex].updatedAt = new Date();
  } else {
    grade.assignmentGrades.push({
      assignment: assignmentId,
      points: points,
      maxPoints: maxPoints,
      gradedAt: new Date()
    });
  }

  await calculateOverallGrade(grade);
  await grade.save();
}

module.exports = gradeController;