const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Student = require('../../models/Student');
const FeeStructure = require('../../models/FeeStructure');
const { reportService } = require('../../services/reportService');
const { pdfService } = require('../../services/pdfService');
const { excelService } = require('../../services/excelService');

const reportController = {
  // Generate financial report
  generateFinancialReport: async (req, res) => {
    try {
      const { startDate, endDate, reportType, format = 'json' } = req.query;

      const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate) : new Date();

      let reportData;

      switch (reportType) {
        case 'revenue':
          reportData = await reportService.generateRevenueReport(start, end);
          break;
        case 'outstanding':
          reportData = await reportService.generateOutstandingFeesReport();
          break;
        case 'collection':
          reportData = await reportService.generateCollectionReport(start, end);
          break;
        case 'student':
          reportData = await reportService.generateStudentFeeReport();
          break;
        default:
          reportData = await reportService.generateComprehensiveReport(start, end);
      }

      // Return in requested format
      if (format === 'pdf') {
        const pdfBuffer = await pdfService.generateFinancialReport(reportData, reportType, start, end);
        
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename=financial-report-${reportType}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.pdf`
        });

        return res.send(pdfBuffer);
      } else if (format === 'excel') {
        const excelBuffer = await excelService.generateFinancialReport(reportData, reportType, start, end);
        
        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=financial-report-${reportType}-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.xlsx`
        });

        return res.send(excelBuffer);
      }

      res.status(200).json({
        success: true,
        data: reportData,
        metadata: {
          reportType,
          startDate: start,
          endDate: end,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Generate financial report error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get revenue analytics
  getRevenueAnalytics: async (req, res) => {
    try {
      const { period = 'month' } = req.query;
      
      const analytics = await reportService.getRevenueAnalytics(period);

      res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get revenue analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get outstanding fees report
  getOutstandingFees: async (req, res) => {
    try {
      const { program, academicYear, minAmount, maxAmount, page = 1, limit = 20 } = req.query;
      
      const filter = { feeBalance: { $gt: 0 } };

      if (program) filter.program = program;
      if (academicYear) filter.academicYear = academicYear;
      if (minAmount) filter.feeBalance = { ...filter.feeBalance, $gte: parseFloat(minAmount) };
      if (maxAmount) filter.feeBalance = { ...filter.feeBalance, $lte: parseFloat(maxAmount) };

      const students = await Student.find(filter)
        .populate('user', 'firstName lastName email phone')
        .populate('feeStructure')
        .select('studentId user program academicYear semester feeBalance totalFees paymentHistory')
        .sort({ feeBalance: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Student.countDocuments(filter);
      const totalOutstanding = await Student.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$feeBalance' } } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          students,
          summary: {
            totalStudents: total,
            totalOutstanding: totalOutstanding[0]?.total || 0,
            averageOutstanding: totalOutstanding[0]?.total / total || 0
          },
          pagination: {
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total
          }
        }
      });
    } catch (error) {
      console.error('Get outstanding fees error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get payment trends
  getPaymentTrends: async (req, res) => {
    try {
      const { period = 'month', year = new Date().getFullYear() } = req.query;

      const trends = await reportService.getPaymentTrends(period, year);

      res.status(200).json({
        success: true,
        data: trends
      });
    } catch (error) {
      console.error('Get payment trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Export financial data
  exportFinancialData: async (req, res) => {
    try {
      const { dataType, format = 'excel', startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      let exportData;
      let filename;

      switch (dataType) {
        case 'payments':
          exportData = await reportService.exportPaymentsData(start, end);
          filename = `payments-export-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'invoices':
          exportData = await reportService.exportInvoicesData(start, end);
          filename = `invoices-export-${new Date().toISOString().split('T')[0]}`;
          break;
        case 'students':
          exportData = await reportService.exportStudentsFinancialData();
          filename = `students-financial-export-${new Date().toISOString().split('T')[0]}`;
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid data type'
          });
      }

      if (format === 'excel') {
        const excelBuffer = await excelService.exportFinancialData(exportData, dataType);
        
        res.set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=${filename}.xlsx`
        });

        return res.send(excelBuffer);
      } else if (format === 'csv') {
        const csvData = await excelService.convertToCSV(exportData, dataType);
        
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=${filename}.csv`
        });

        return res.send(csvData);
      }

      res.status(200).json({
        success: true,
        data: exportData
      });
    } catch (error) {
      console.error('Export financial data error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  },

  // Get dashboard statistics
  getDashboardStats: async (req, res) => {
    try {
      const stats = await reportService.getFinancialDashboardStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
};

module.exports = reportController;