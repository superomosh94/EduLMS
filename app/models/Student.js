const db = require('../../config/database');

class Student {
    /**
     * Find student by user ID
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Student data
     */
    static async findByUserId(userId) {
        try {
            const [students] = await db.promise().execute(
                `SELECT u.*, r.name as role_name 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.id = ? AND u.role_id = 3`,
                [userId]
            );
            return students[0] || null;
        } catch (error) {
            console.error('Error finding student by user ID:', error);
            return null;
        }
    }

    /**
     * Find student by student ID
     * @param {string} studentId - Student ID
     * @returns {Promise<Object>} - Student data
     */
    static async findByStudentId(studentId) {
        try {
            const [students] = await db.promise().execute(
                `SELECT u.*, r.name as role_name 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.student_id = ? AND u.role_id = 3`,
                [studentId]
            );
            return students[0] || null;
        } catch (error) {
            console.error('Error finding student by student ID:', error);
            return null;
        }
    }

    /**
     * Get all students
     * @returns {Promise<Array>} - List of students
     */
    static async findAll() {
        try {
            const [students] = await db.promise().execute(
                `SELECT u.*, r.name as role_name 
                 FROM users u 
                 JOIN roles r ON u.role_id = r.id 
                 WHERE u.role_id = 3 
                 ORDER BY u.created_at DESC`
            );
            return students;
        } catch (error) {
            console.error('Error finding all students:', error);
            return [];
        }
    }

    /**
     * Get student courses
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - List of enrolled courses
     */
    static async getCourses(userId) {
        try {
            const [courses] = await db.promise().execute(
                `SELECT c.*, e.enrolled_at 
                 FROM courses c 
                 JOIN enrollments e ON c.id = e.course_id 
                 WHERE e.user_id = ? AND e.status = 'active' 
                 ORDER BY e.enrolled_at DESC`,
                [userId]
            );
            return courses;
        } catch (error) {
            console.error('Error getting student courses:', error);
            return [];
        }
    }

    /**
     * Get student assignments
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - List of assignments
     */
    static async getAssignments(userId) {
        try {
            const [assignments] = await db.promise().execute(
                `SELECT a.*, c.name as course_name, 
                        s.status as submission_status,
                        s.submitted_at,
                        g.grade
                 FROM assignments a
                 JOIN courses c ON a.course_id = c.id
                 JOIN enrollments e ON c.id = e.course_id
                 LEFT JOIN submissions s ON a.id = s.assignment_id AND s.user_id = ?
                 LEFT JOIN grades g ON a.id = g.assignment_id AND g.user_id = ?
                 WHERE e.user_id = ? AND e.status = 'active'
                 ORDER BY a.due_date ASC`,
                [userId, userId, userId]
            );
            return assignments;
        } catch (error) {
            console.error('Error getting student assignments:', error);
            return [];
        }
    }

    /**
     * Get student grades
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - List of grades
     */
    static async getGrades(userId) {
        try {
            const [grades] = await db.promise().execute(
                `SELECT g.*, a.title as assignment_title, 
                        c.name as course_name,
                        a.max_points
                 FROM grades g
                 JOIN assignments a ON g.assignment_id = a.id
                 JOIN courses c ON a.course_id = c.id
                 WHERE g.user_id = ?
                 ORDER BY g.graded_at DESC`,
                [userId]
            );
            return grades;
        } catch (error) {
            console.error('Error getting student grades:', error);
            return [];
        }
    }

    /**
     * Get student payments
     * @param {number} userId - User ID
     * @returns {Promise<Array>} - List of payments
     */
    static async getPayments(userId) {
        try {
            const [payments] = await db.promise().execute(
                `SELECT * FROM payments 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC`,
                [userId]
            );
            return payments;
        } catch (error) {
            console.error('Error getting student payments:', error);
            return [];
        }
    }

    /**
     * Update student profile
     * @param {number} userId - User ID
     * @param {Object} updateData - Update data
     * @returns {Promise<boolean>} - Success status
     */
    static async updateProfile(userId, updateData) {
        try {
            const allowedFields = ['phone', 'address', 'date_of_birth', 'gender', 'profile_image'];
            
            const fieldsToUpdate = {};
            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    fieldsToUpdate[field] = updateData[field];
                }
            });

            if (Object.keys(fieldsToUpdate).length === 0) {
                throw new Error('No valid fields to update');
            }

            const setClause = Object.keys(fieldsToUpdate).map(field => `${field} = ?`).join(', ');
            const values = [...Object.values(fieldsToUpdate), userId];

            await db.promise().execute(
                `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`,
                values
            );

            return true;
        } catch (error) {
            console.error('Error updating student profile:', error);
            throw error;
        }
    }

    /**
     * Get student dashboard statistics
     * @param {number} userId - User ID
     * @returns {Promise<Object>} - Dashboard stats
     */
    static async getDashboardStats(userId) {
        try {
            const [courses] = await db.promise().execute(
                'SELECT COUNT(*) as total FROM enrollments WHERE user_id = ? AND status = "active"',
                [userId]
            );
            
            const [assignments] = await db.promise().execute(
                `SELECT COUNT(*) as total FROM assignments a
                 JOIN enrollments e ON a.course_id = e.course_id
                 WHERE e.user_id = ? AND a.due_date >= CURDATE()`,
                [userId]
            );
            
            const [submissions] = await db.promise().execute(
                'SELECT COUNT(*) as total FROM submissions WHERE user_id = ? AND status = "submitted"',
                [userId]
            );
            
            const [payments] = await db.promise().execute(
                'SELECT COUNT(*) as total FROM payments WHERE user_id = ? AND status = "completed"',
                [userId]
            );

            return {
                totalCourses: courses[0].total,
                pendingAssignments: assignments[0].total,
                submittedAssignments: submissions[0].total,
                completedPayments: payments[0].total
            };
        } catch (error) {
            console.error('Error getting student dashboard stats:', error);
            return {
                totalCourses: 0,
                pendingAssignments: 0,
                submittedAssignments: 0,
                completedPayments: 0
            };
        }
    }
}

module.exports = Student;