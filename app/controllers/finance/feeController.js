const FeeStructure = require('../../models/FeeStructure');
const Student = require('../../models/Student');
const { validationResult } = require('express-validator');

const feeController = {
  // Create fee structure
  createFeeStructure: async (req, res) => {
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
        name,
        description,
        academicYear,
        semester,
        program,
        amount,
        dueDate,
        isActive,
        feeType
      } = req.body;

      const feeStructure = new FeeStructure({
        name,
        description,
        academicYear,
        semester,
        program,
        amount,
        dueDate,
        isActive: isActive !== undefined ? isActive : true,
        feeType,
        createdBy: req.user.id
      });

      await feeStructure.save();

      res.status(201).json({
        success: true,
        message: 'Fee structure created successfully',
        data: feeStructure
      });
    } catch (error) {
      console.error('Create fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get all fee structures
  getFeeStructures: async (req, res) => {
    try {
      const { program, academicYear, semester, isActive, page = 1, limit = 10 } = req.query;
      const filter = {};

      if (program) filter.program = program;
      if (academicYear) filter.academicYear = academicYear;
      if (semester) filter.semester = semester;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const feeStructures = await FeeStructure.find(filter)
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await FeeStructure.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          feeStructures,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get fee structures error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get fee structure by ID
  getFeeStructure: async (req, res) => {
    try {
      const { id } = req.params;

      const feeStructure = await FeeStructure.findById(id)
        .populate('createdBy', 'firstName lastName');

      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      res.status(200).json({
        success: true,
        data: feeStructure
      });
    } catch (error) {
      console.error('Get fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update fee structure
  updateFeeStructure: async (req, res) => {
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

      const feeStructure = await FeeStructure.findByIdAndUpdate(
        id,
        { ...updateData, updatedBy: req.user.id },
        { new: true, runValidators: true }
      );

      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Fee structure updated successfully',
        data: feeStructure
      });
    } catch (error) {
      console.error('Update fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Delete fee structure
  deleteFeeStructure: async (req, res) => {
    try {
      const { id } = req.params;

      const feeStructure = await FeeStructure.findById(id);
      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      // Check if fee structure is in use
      const studentsWithFee = await Student.findOne({ 
        feeStructure: id,
        feeBalance: { $gt: 0 }
      });

      if (studentsWithFee) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete fee structure. It is currently assigned to students with outstanding balances.'
        });
      }

      await FeeStructure.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Fee structure deleted successfully'
      });
    } catch (error) {
      console.error('Delete fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Assign fee structure to students
  assignFeeStructure: async (req, res) => {
    try {
      const { feeStructureId, studentIds, academicYear, semester } = req.body;

      const feeStructure = await FeeStructure.findById(feeStructureId);
      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      const updateResult = await Student.updateMany(
        { _id: { $in: studentIds } },
        {
          $set: {
            feeStructure: feeStructureId,
            academicYear,
            semester,
            feeBalance: feeStructure.amount,
            totalFees: feeStructure.amount
          }
        }
      );

      res.status(200).json({
        success: true,
        message: `Fee structure assigned to ${updateResult.modifiedCount} students`,
        data: {
          modifiedCount: updateResult.modifiedCount
        }
      });
    } catch (error) {
      console.error('Assign fee structure error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get student fee statement
  getStudentFeeStatement: async (req, res) => {
    try {
      const { studentId } = req.params;

      const student = await Student.findById(studentId)
        .populate('user', 'firstName lastName email')
        .populate('feeStructure')
        .populate('paymentHistory');

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const feeStatement = {
        student: {
          id: student._id,
          studentId: student.studentId,
          name: `${student.user.firstName} ${student.user.lastName}`,
          program: student.program,
          academicYear: student.academicYear,
          semester: student.semester
        },
        feeStructure: student.feeStructure,
        totalFees: student.totalFees,
        feeBalance: student.feeBalance,
        amountPaid: student.totalFees - student.feeBalance,
        paymentHistory: student.paymentHistory,
        outstandingAmount: student.feeBalance
      };

      res.status(200).json({
        success: true,
        data: feeStatement
      });
    } catch (error) {
      console.error('Get fee statement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = feeController;