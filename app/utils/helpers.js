const path = require('path');
const fs = require('fs').promises;

// File upload helper
const handleFileUpload = async (file, uploadPath, allowedTypes = []) => {
    try {
        if (!file) {
            return { success: false, error: 'No file provided' };
        }

        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
            return { success: false, error: 'File type not allowed' };
        }

        // Generate unique filename
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${fileExt}`;
        const filePath = path.join(uploadPath, fileName);

        // Ensure upload directory exists
        await fs.mkdir(uploadPath, { recursive: true });

        // Move file
        await fs.rename(file.path, filePath);

        return {
            success: true,
            fileName: fileName,
            filePath: filePath,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Delete file helper
const deleteFile = async (filePath) => {
    try {
        await fs.unlink(filePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
};

// Send response helper
const sendResponse = (res, statusCode, success, message, data = null) => {
    const response = { success, message };
    if (data) response.data = data;
    return res.status(statusCode).json(response);
};

// Error handler
const handleError = (res, error, customMessage = 'An error occurred') => {
    console.error('Error:', error);
    
    let message = customMessage;
    let statusCode = 500;

    if (error.name === 'SequelizeValidationError') {
        message = 'Validation error';
        statusCode = 400;
    } else if (error.name === 'SequelizeUniqueConstraintError') {
        message = 'Record already exists';
        statusCode = 400;
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
        message = 'Related record not found';
        statusCode = 400;
    }

    return sendResponse(res, statusCode, false, message);
};

// Generate pagination links
const generatePaginationLinks = (req, page, totalPages) => {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
    const query = { ...req.query };
    
    const links = {
        first: null,
        prev: null,
        next: null,
        last: null
    };

    if (page > 1) {
        query.page = 1;
        links.first = `${baseUrl}?${new URLSearchParams(query)}`;
        
        query.page = page - 1;
        links.prev = `${baseUrl}?${new URLSearchParams(query)}`;
    }

    if (page < totalPages) {
        query.page = page + 1;
        links.next = `${baseUrl}?${new URLSearchParams(query)}`;
        
        query.page = totalPages;
        links.last = `${baseUrl}?${new URLSearchParams(query)}`;
    }

    return links;
};

// Sanitize user input for SQL
const sanitizeSQL = (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/['";\\]/g, '');
};

// Check if user has permission
const hasPermission = (user, requiredPermissions) => {
    if (!user || !user.role) return false;
    
    const rolePermissions = {
        admin: ['read', 'write', 'delete', 'manage_users', 'manage_courses', 'manage_finance'],
        instructor: ['read', 'write', 'manage_courses', 'manage_assignments', 'manage_grades'],
        finance: ['read', 'write', 'manage_finance', 'manage_payments'],
        student: ['read', 'submit_assignments', 'view_grades']
    };

    const userPermissions = rolePermissions[user.role] || [];
    return requiredPermissions.every(permission => userPermissions.includes(permission));
};

// Generate receipt number
const generateReceiptNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `RCP${timestamp.slice(-6)}${random}`;
};

// Calculate due date
const calculateDueDate = (days = 30) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
};

// Format phone number to Kenyan format
const formatPhoneNumber = (phone) => {
    if (!phone) return null;
    
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Convert to 254 format
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
        cleaned = '254' + cleaned;
    }
    
    return cleaned;
};

module.exports = {
    handleFileUpload,
    deleteFile,
    sendResponse,
    handleError,
    generatePaginationLinks,
    sanitizeSQL,
    hasPermission,
    generateReceiptNumber,
    calculateDueDate,
    formatPhoneNumber
};