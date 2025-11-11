const Invoice = require('../../models/Invoice');
const Student = require('../../models/Student');
const FeeStructure = require('../../models/FeeStructure');
const { pdfService } = require('../../services/pdfService');
const { emailService } = require('../../services/emailService');
const { validationResult } = require('express-validator');

const invoiceController = {
  // Generate invoice
  generateInvoice: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { studentId, feeStructureId, dueDate, additionalCharges = [] } = req.body;

      const student = await Student.findById(studentId)
        .populate('user', 'firstName lastName email phone')
        .populate('feeStructure');

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      const feeStructure = await FeeStructure.findById(feeStructureId || student.feeStructure);
      if (!feeStructure) {
        return res.status(404).json({
          success: false,
          message: 'Fee structure not found'
        });
      }

      // Calculate total amount
      const additionalAmount = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const totalAmount = feeStructure.amount + additionalAmount;

      // Generate invoice number
      const invoiceCount = await Invoice.countDocuments();
      const invoiceNumber = `INV-${new Date().getFullYear()}-${(invoiceCount + 1).toString().padStart(5, '0')}`;

      const invoice = new Invoice({
        invoiceNumber,
        student: studentId,
        feeStructure: feeStructure._id,
        academicYear: student.academicYear,
        semester: student.semester,
        dueDate: dueDate || feeStructure.dueDate,
        items: [
          {
            description: feeStructure.name,
            amount: feeStructure.amount,
            quantity: 1
          },
          ...additionalCharges
        ],
        totalAmount,
        status: 'pending',
        generatedBy: req.user.id
      });

      await invoice.save();

      // Update student's fee balance
      student.totalFees = (student.totalFees || 0) + totalAmount;
      student.feeBalance = (student.feeBalance || 0) + totalAmount;
      await student.save();

      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice
      });
    } catch (error) {
      console.error('Generate invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get all invoices
  getInvoices: async (req, res) => {
    try {
      const { studentId, status, academicYear, semester, page = 1, limit = 10 } = req.query;
      const filter = {};

      if (studentId) filter.student = studentId;
      if (status) filter.status = status;
      if (academicYear) filter.academicYear = academicYear;
      if (semester) filter.semester = semester;

      const invoices = await Invoice.find(filter)
        .populate('student', 'studentId user')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email' }
        })
        .populate('feeStructure')
        .populate('generatedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Invoice.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          invoices,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get invoice by ID
  getInvoice: async (req, res) => {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('student', 'studentId user')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email phone address' }
        })
        .populate('feeStructure')
        .populate('generatedBy', 'firstName lastName');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.status(200).json({
        success: true,
        data: invoice
      });
    } catch (error) {
      console.error('Get invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Send invoice via email
  sendInvoice: async (req, res) => {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('student')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email' }
        })
        .populate('feeStructure');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      // Generate PDF invoice
      const pdfBuffer = await pdfService.generateInvoice(invoice);

      // Send email with PDF attachment
      await emailService.sendInvoice(
        invoice.student.user.email,
        invoice.student.user.firstName,
        invoice,
        pdfBuffer
      );

      invoice.sentAt = new Date();
      invoice.sentBy = req.user.id;
      await invoice.save();

      res.status(200).json({
        success: true,
        message: 'Invoice sent successfully'
      });
    } catch (error) {
      console.error('Send invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Download invoice as PDF
  downloadInvoice: async (req, res) => {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('student')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email phone address' }
        })
        .populate('feeStructure');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      const pdfBuffer = await pdfService.generateInvoice(invoice);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`
      });

      res.send(pdfBuffer);
    } catch (error) {
      console.error('Download invoice error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Update invoice status
  updateInvoiceStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const invoice = await Invoice.findByIdAndUpdate(
        id,
        { status, updatedBy: req.user.id },
        { new: true }
      );

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invoice status updated successfully',
        data: invoice
      });
    } catch (error) {
      console.error('Update invoice status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get invoice statistics
  getInvoiceStats: async (req, res) => {
    try {
      const stats = await Invoice.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      const totalStats = await Invoice.aggregate([
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            averageAmount: { $avg: '$totalAmount' }
          }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          statusBreakdown: stats,
          overview: totalStats[0] || { totalInvoices: 0, totalAmount: 0, averageAmount: 0 }
        }
      });
    } catch (error) {
      console.error('Get invoice stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = invoiceController;