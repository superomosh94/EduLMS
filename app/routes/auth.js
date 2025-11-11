const express = require('express');
const router = express.Router();
const passport = require('passport');

// Safe import with detailed error handling for middleware
let ensureAuthenticated, ensureGuest;
try {
    const authMiddleware = require('../middleware/auth');
    ensureAuthenticated = authMiddleware.ensureAuthenticated || ((req, res, next) => next());
    ensureGuest = authMiddleware.ensureGuest || ((req, res, next) => next());
} catch (error) {
    console.error('❌ Error loading auth middleware:', error.message);
    ensureAuthenticated = (req, res, next) => next();
    ensureGuest = (req, res, next) => next();
}

// Safe import with detailed error handling for controllers
let authController, passwordController;
try {
    authController = require('../controllers/auth/authController');
    
    // Validate that required methods exist
    if (!authController.register || !authController.login || !authController.logout) {
        throw new Error('Auth controller methods are missing');
    }
    
    console.log('✅ Auth controller loaded successfully');
} catch (error) {
    console.error('❌ Error loading auth controller:', error.message);
    authController = {
        register: (req, res) => {
            console.error('Auth controller not available - register');
            req.flash('error_msg', 'System temporarily unavailable. Please try again later.');
            res.redirect('/auth/register');
        },
        login: (req, res) => {
            console.error('Auth controller not available - login');
            req.flash('error_msg', 'System temporarily unavailable. Please try again later.');
            res.redirect('/auth/login');
        },
        logout: (req, res) => {
            req.logout((err) => {
                if (err) console.error('Logout error:', err);
                res.redirect('/auth/login');
            });
        }
    };
}

try {
    passwordController = require('../controllers/auth/passwordController');
    
    // Validate that required methods exist
    if (!passwordController.forgotPassword || !passwordController.resetPassword) {
        throw new Error('Password controller methods are missing');
    }
    
    console.log('✅ Password controller loaded successfully');
} catch (error) {
    console.error('❌ Error loading password controller:', error.message);
    passwordController = {
        forgotPassword: (req, res) => {
            console.error('Password controller not available - forgotPassword');
            req.flash('error_msg', 'Password reset temporarily unavailable. Please try again later.');
            res.redirect('/auth/forgot-password');
        },
        resetPassword: (req, res) => {
            console.error('Password controller not available - resetPassword');
            req.flash('error_msg', 'Password reset temporarily unavailable. Please try again later.');
            res.redirect('/auth/forgot-password');
        }
    };
}

// Safe import for validators
let validateRegistration, validateLogin;
try {
    const validators = require('../validators/userValidators');
    validateRegistration = validators.validateRegistration || ((req, res, next) => next());
    validateLogin = validators.validateLogin || ((req, res, next) => next());
} catch (error) {
    console.error('❌ Error loading validators:', error.message);
    validateRegistration = (req, res, next) => next();
    validateLogin = (req, res, next) => next();
}

// Helper function to safely handle route callbacks
const safeHandler = (handler, routeName) => {
    return (req, res, next) => {
        try {
            if (typeof handler !== 'function') {
                throw new Error(`Handler for ${routeName} is not a function`);
            }
            return handler(req, res, next);
        } catch (error) {
            console.error(`❌ Route handler error for ${routeName}:`, error);
            req.flash('error_msg', 'Something went wrong. Please try again.');
            
            // Redirect to appropriate page based on route
            if (routeName.includes('login')) {
                return res.redirect('/auth/login');
            } else if (routeName.includes('register')) {
                return res.redirect('/auth/register');
            } else {
                return res.redirect('/auth/login');
            }
        }
    };
};

// ==================== AUTH ROUTES ====================

// GET /auth/login
router.get('/login', 
    safeHandler(ensureGuest, 'ensureGuest'), 
    (req, res) => {
        res.render('auth/login', {
            title: 'Login - EduLMS',
            error: req.flash('error'),
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg'),
            layout: 'layouts/layout'
        });
    }
);

// GET /auth/register
router.get('/register', 
    safeHandler(ensureGuest, 'ensureGuest'), 
    (req, res) => {
        res.render('auth/register', {
            title: 'Register - EduLMS',
            error: req.flash('error'),
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg'),
            layout: 'layouts/layout'
        });
    }
);

// POST /auth/register
router.post('/register', 
    safeHandler(validateRegistration, 'validateRegistration'),
    safeHandler(authController.register, 'authController.register')
);

// POST /auth/login
router.post('/login', 
    safeHandler(validateLogin, 'validateLogin'),
    safeHandler(authController.login, 'authController.login')
);

// GET /auth/logout
router.get('/logout', 
    safeHandler(authController.logout, 'authController.logout')
);

// ==================== PASSWORD ROUTES ====================

// GET /auth/forgot-password
router.get('/forgot-password', 
    safeHandler(ensureGuest, 'ensureGuest'), 
    (req, res) => {
        res.render('auth/forgot-password', {
            title: 'Forgot Password - EduLMS',
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg'),
            layout: 'layouts/layout'
        });
    }
);

// POST /auth/forgot-password
router.post('/forgot-password', 
    safeHandler(passwordController.forgotPassword, 'passwordController.forgotPassword')
);

// GET /auth/reset-password
router.get('/reset-password', 
    safeHandler(ensureGuest, 'ensureGuest'), 
    (req, res) => {
        const { token } = req.query;
        if (!token) {
            req.flash('error_msg', 'Invalid or missing reset token');
            return res.redirect('/auth/forgot-password');
        }
        res.render('auth/reset-password', {
            title: 'Reset Password - EduLMS',
            token: token,
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg'),
            layout: 'layouts/layout'
        });
    }
);

// POST /auth/reset-password
router.post('/reset-password', 
    safeHandler(passwordController.resetPassword, 'passwordController.resetPassword')
);

// ==================== EMAIL VERIFICATION ROUTES ====================

// GET /auth/verify-email
router.get('/verify-email', 
    safeHandler(ensureGuest, 'ensureGuest'), 
    (req, res) => {
        const { token } = req.query;
        res.render('auth/verify-email', {
            title: 'Verify Email - EduLMS',
            token: token || '',
            error_msg: req.flash('error_msg'),
            success_msg: req.flash('success_msg'),
            layout: 'layouts/layout'
        });
    }
);

// ==================== HEALTH CHECK ROUTE ====================

// GET /auth/health - For debugging purposes
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        controllers: {
            auth: {
                register: typeof authController.register,
                login: typeof authController.login,
                logout: typeof authController.logout
            },
            password: {
                forgotPassword: typeof passwordController.forgotPassword,
                resetPassword: typeof passwordController.resetPassword
            }
        },
        middleware: {
            ensureAuthenticated: typeof ensureAuthenticated,
            ensureGuest: typeof ensureGuest
        },
        validators: {
            validateRegistration: typeof validateRegistration,
            validateLogin: typeof validateLogin
        }
    });
});

// ==================== FALLBACK ROUTE ====================

// Catch-all for undefined auth routes
router.use('*', (req, res) => {
    console.warn(`⚠️  Attempted to access undefined auth route: ${req.originalUrl}`);
    req.flash('error_msg', 'Page not found');
    res.redirect('/auth/login');
});

module.exports = router;