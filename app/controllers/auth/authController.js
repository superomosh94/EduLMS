const User = require('../../models/User');
const Student = require('../../models/Student');
const Instructor = require('../../models/Instructor');
const { generateRandomString, generateStudentId } = require('../../utils');
const { sendResponse, handleError } = require('../../utils/helpers');

const authController = {
    /**
     * Register new user
     */
    register: async (req, res) => {
        try {
            const { firstName, lastName, email, password, phone, role, program, department, qualifications } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ where: { email } });
            if (existingUser) {
                return sendResponse(res, 400, false, 'User with this email already exists');
            }

            // Create user
            const user = await User.create({
                firstName,
                lastName,
                email: email.toLowerCase(),
                password,
                phone,
                role
            });

            // Create role-specific profile
            if (role === 'student') {
                await Student.create({
                    userId: user.id,
                    studentId: generateStudentId(),
                    program: program || 'General',
                    department: department || 'General',
                    academicYear: '2024',
                    semester: '1'
                });
            } else if (role === 'instructor') {
                await Instructor.create({
                    userId: user.id,
                    department: department || 'General',
                    qualifications: qualifications || 'Not specified'
                });
            }

            // Log in user automatically after registration
            req.login(user, (err) => {
                if (err) {
                    console.error('Auto-login error:', err);
                }
                
                sendResponse(res, 201, true, 'Registration successful', {
                    user: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role
                    }
                });
            });

        } catch (error) {
            handleError(res, error, 'Registration failed');
        }
    },

    /**
     * Login user
     */
    login: (req, res, next) => {
        passport.authenticate('local', (err, user, info) => {
            if (err) {
                return handleError(res, err, 'Login failed');
            }
            
            if (!user) {
                return sendResponse(res, 401, false, info.message || 'Invalid credentials');
            }

            req.login(user, (err) => {
                if (err) {
                    return handleError(res, err, 'Login failed');
                }

                sendResponse(res, 200, true, 'Login successful', {
                    user: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: user.role
                    }
                });
            });
        })(req, res, next);
    },

    /**
     * Logout user
     */
    logout: (req, res) => {
        req.logout((err) => {
            if (err) {
                return handleError(res, err, 'Logout failed');
            }
            
            req.flash('success_msg', 'You have been logged out successfully');
            res.redirect('/auth/login');
        });
    },

    /**
     * Get current user
     */
    getCurrentUser: (req, res) => {
        if (!req.user) {
            return sendResponse(res, 401, false, 'Not authenticated');
        }

        sendResponse(res, 200, true, 'User data retrieved', {
            user: {
                id: req.user.id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
                role: req.user.role,
                avatar: req.user.avatar
            }
        });
    }
};

module.exports = authController;