const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class IdGeneratorService {
    /**
     * Generate a unique ID with optional prefix
     * @param {string} prefix - Prefix for the ID (e.g., 'USR', 'STU', 'CRS')
     * @param {number} length - Length of the random part (default: 12)
     * @returns {string} - Generated unique ID
     */
    static generateId(prefix = '', length = 12) {
        const randomBytes = crypto.randomBytes(Math.ceil(length / 2));
        const randomString = randomBytes.toString('hex').slice(0, length);
        
        return prefix ? `${prefix}_${randomString}` : randomString;
    }

    /**
     * Generate role-based ID (alias for generateRoleBasedId for backward compatibility)
     * @param {number} role_id - User role ID
     * @returns {string} - Generated role-based ID
     */
    static generateRoleBasedID(role_id) {
        return this.generateRoleBasedId(role_id);
    }

    /**
     * Generate role-based ID
     * @param {number} role_id - User role ID
     * @returns {string} - Generated role-based ID
     */
    static generateRoleBasedId(role_id) {
        const prefixes = {
            1: 'ADM', // Admin
            2: 'INS', // Instructor
            3: 'STU', // Student
            4: 'FIN'  // Finance
        };
        
        const prefix = prefixes[role_id] || 'USR';
        return this.generateId(prefix, 8);
    }

    /**
     * Generate user ID based on role
     * @param {string} role - User role (student, instructor, admin, finance)
     * @returns {string} - Generated user ID
     */
    static generateUserId(role) {
        const prefixes = {
            'student': 'STU',
            'instructor': 'INS',
            'admin': 'ADM',
            'finance': 'FIN'
        };
        
        const prefix = prefixes[role.toLowerCase()] || 'USR';
        return this.generateId(prefix, 10);
    }

    /**
     * Generate course ID
     * @returns {string} - Generated course ID
     */
    static generateCourseId() {
        return this.generateId('CRS', 8);
    }

    /**
     * Generate enrollment ID
     * @returns {string} - Generated enrollment ID
     */
    static generateEnrollmentId() {
        return this.generateId('ENR', 10);
    }

    /**
     * Generate payment ID
     * @returns {string} - Generated payment ID
     */
    static generatePaymentId() {
        return this.generateId('PAY', 10);
    }

    /**
     * Generate assignment ID
     * @returns {string} - Generated assignment ID
     */
    static generateAssignmentId() {
        return this.generateId('ASG', 8);
    }

    /**
     * Generate submission ID
     * @returns {string} - Generated submission ID
     */
    static generateSubmissionId() {
        return this.generateId('SUB', 10);
    }

    /**
     * Generate notification ID
     * @returns {string} - Generated notification ID
     */
    static generateNotificationId() {
        return this.generateId('NOT', 10);
    }

    /**
     * Generate UUID (for tokens, etc.)
     * @returns {string} - Generated UUID
     */
    static generateUUID() {
        return uuidv4();
    }

    /**
     * Generate short code (for verification codes, etc.)
     * @param {number} length - Length of the code (default: 6)
     * @returns {string} - Generated code
     */
    static generateCode(length = 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

module.exports = IdGeneratorService;