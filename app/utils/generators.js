const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Generate PDF receipt
const generateReceiptPDF = (payment) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const chunks = [];
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            doc.fontSize(20).font('Helvetica-Bold')
               .text('EDULMS INSTITUTION', 50, 50, { align: 'center' });
            
            doc.fontSize(12).font('Helvetica')
               .text('Official Receipt', 50, 80, { align: 'center' });
            
            // Receipt details
            doc.fontSize(10)
               .text(`Receipt Number: ${payment.receiptNumber || payment.reference}`, 50, 120)
               .text(`Date: ${new Date(payment.paidAt).toLocaleDateString()}`, 50, 135)
               .text(`Time: ${new Date(payment.paidAt).toLocaleTimeString()}`, 50, 150);
            
            // Student information
            doc.text(`Student: ${payment.studentName || 'N/A'}`, 50, 180)
               .text(`Student ID: ${payment.studentId || 'N/A'}`, 50, 195)
               .text(`Program: ${payment.program || 'N/A'}`, 50, 210);
            
            // Payment details
            doc.moveDown(2)
               .text('Payment Details:', 50, 250)
               .text(`Amount: KES ${payment.amount}`, 50, 265)
               .text(`Payment Method: ${payment.paymentMethod}`, 50, 280)
               .text(`Transaction ID: ${payment.transactionId || 'N/A'}`, 50, 295);
            
            // Footer
            doc.text('Thank you for your payment!', 50, 350, { align: 'center' });
            doc.text('This is an computer generated receipt.', 50, 400, { align: 'center' });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

// Generate Excel report
const generateExcelReport = async (data, headers, title = 'Report') => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(title);
    
    // Add title
    worksheet.mergeCells('A1:' + String.fromCharCode(64 + headers.length) + '1');
    worksheet.getCell('A1').value = title;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    // Add headers
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE6E6FA' }
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    
    // Add data
    data.forEach(item => {
        const row = worksheet.addRow(Object.values(item));
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    });
    
    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = Math.min(maxLength + 2, 50);
    });
    
    return await workbook.xlsx.writeBuffer();
};

// Generate invoice number
const generateInvoiceNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(100 + Math.random() * 900);
    return `INV-${timestamp.slice(-6)}-${random}`;
};

// Generate assignment submission code
const generateSubmissionCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// Generate course code
const generateCourseCode = (department, level) => {
    const deptCode = department.substring(0, 3).toUpperCase();
    const courseNum = Math.floor(100 + Math.random() * 900);
    return `${deptCode}${level}${courseNum}`;
};

module.exports = {
    generateReceiptPDF,
    generateExcelReport,
    generateInvoiceNumber,
    generateSubmissionCode,
    generateCourseCode
};