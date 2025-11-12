const Payment = require('../../models/Payment');
const Student = require('../../models/Student');
const FeeStructure = require('../../models/FeeStructure');
const { mpesaService } = require('../../services/mpesaService');
const { pdfService } = require('../../services/pdfService');
const { emailService } = require('../../services/emailService');
const { validationResult } = require('express-validator');

const paymentController = {
  
  // Process M-Pesa payment
  processMpesaPayment: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const { studentId, amount, phoneNumber, description } = req.body;
      
      // Find student
      const student = await Student.findById(studentId).populate('user');
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found'
        });
      }

      // Initiate M-Pesa payment
      const mpesaResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        amount,
        student.studentId,
        description
      );

      if (mpesaResponse.success) {
        // Create pending payment record
        const payment = new Payment({
          student: studentId,
          amount,
          paymentMethod: 'mpesa',
          phoneNumber,
          description,
          reference: mpesaResponse.reference,
          status: 'pending',
          mpesaCheckoutId: mpesaResponse.checkoutRequestID
        });

        await payment.save();

        res.status(200).json({
          success: true,
          message: 'Payment initiated successfully',
          data: {
            paymentId: payment._id,
            checkoutRequestID: mpesaResponse.checkoutRequestID
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to initiate payment',
          error: mpesaResponse.error
        });
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Handle M-Pesa callback
  handleMpesaCallback: async (req, res) => {
    try {
      const callbackData = req.body;
      
      // Process M-Pesa callback
      const result = await mpesaService.processCallback(callbackData);
      
      if (result.success) {
        const payment = await Payment.findOne({
          mpesaCheckoutId: result.checkoutRequestID
        });

        if (payment) {
          payment.status = result.status;
          payment.transactionId = result.transactionId;
          payment.paidAt = new Date();
          await payment.save();

          // Update student's fee balance
          await Student.findByIdAndUpdate(
            payment.student,
            { 
              $inc: { feeBalance: -payment.amount },
              $push: { paymentHistory: payment._id }
            }
          );

          // Send confirmation email
          const student = await Student.findById(payment.student).populate('user');
          if (student && student.user.email) {
            await emailService.sendPaymentConfirmation(
              student.user.email,
              student.user.firstName,
              payment
            );
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Callback processing error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Get payment history
  getPaymentHistory: async (req, res) => {
    try {
      const { studentId, page = 1, limit = 10, status } = req.query;
      const filter = {};
      
      if (studentId) filter.student = studentId;
      if (status) filter.status = status;

      const payments = await Payment.find(filter)
        .populate('student', 'studentId user')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email' }
        })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Payment.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          payments,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total
        }
      });
    } catch (error) {
      console.error('Get payment history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Verify payment manually
  verifyPayment: async (req, res) => {
    try {
      const { paymentId } = req.params;
      
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify payment with M-Pesa
      const verification = await mpesaService.verifyTransaction(payment.transactionId);
      
      if (verification.success) {
        payment.status = 'completed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();

        res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          data: payment
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          error: verification.error
        });
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Generate payment receipt
  generateReceipt: async (req, res) => {
    try {
      const { paymentId } = req.params;
      
      const payment = await Payment.findById(paymentId)
        .populate('student')
        .populate({
          path: 'student',
          populate: { path: 'user', select: 'firstName lastName email' }
        });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      const receiptBuffer = await pdfService.generateReceipt(payment);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=receipt-${payment.reference}.pdf`
      });

      res.send(receiptBuffer);
    } catch (error) {
      console.error('Receipt generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },
// Add these methods to your existing paymentController

// Get payment by ID
getPaymentById: async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await Payment.findById(id)
      .populate('student', 'studentId user')
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName email' }
      })
      .populate('verifiedBy', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if user has permission to view this payment
    if (req.user.role === 'student' && payment.student._id.toString() !== req.user.studentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
},

// Get student's payment history (for student role)
getMyPayments: async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const studentId = req.user.studentId; // Assuming student ID is stored in user
    
    const filter = { student: studentId };
    if (status) filter.status = status;

    const payments = await Payment.find(filter)
      .populate('student', 'studentId user')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        payments,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });
  } catch (error) {
    console.error('Get my payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
},
  // Get payment statistics
  getPaymentStats: async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      const now = new Date();
      let startDate;

      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const stats = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            paidAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            totalPayments: { $sum: 1 },
            averagePayment: { $avg: '$amount' }
          }
        }
      ]);

      const dailyStats = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            paidAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$paidAt' }
            },
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: stats[0] || { totalAmount: 0, totalPayments: 0, averagePayment: 0 },
          dailyStats
        }
      });
    } catch (error) {
      console.error('Get payment stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = paymentController;