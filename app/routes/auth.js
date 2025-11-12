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

// Safe import for validators - handle arrays properly
let validateRegistration, validateLogin;
try {
    const validators = require('../validators/userValidators');
    
    // Check if validators are arrays
    if (Array.isArray(validators.validateRegistration)) {
        validateRegistration = validators.validateRegistration;
        console.log('✅ Registration validators loaded as array');
    } else {
        throw new Error('validateRegistration is not an array');
    }
    
    if (Array.isArray(validators.validateLogin)) {
        validateLogin = validators.validateLogin;
        console.log('✅ Login validators loaded as array');
    } else {
        throw new Error('validateLogin is not an array');
    }
    
} catch (error) {
    console.error('❌ Error loading validators:', error.message);
    
    // SIMPLIFIED Fallback validators for basic registration
    validateRegistration = [
        (req, res, next) => {
            console.log('⚠️  Using simplified registration validation');
            const { first_name, last_name, email, password, confirm_password } = req.body;
            const errors = [];
            
            if (!first_name?.trim()) errors.push('First name is required');
            if (!last_name?.trim()) errors.push('Last name is required');
            if (!email?.trim()) errors.push('Email is required');
            if (!password) errors.push('Password is required');
            if (!confirm_password) errors.push('Confirm password is required');
            
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push('Please provide a valid email address');
            }
            
            if (password && password.length < 8) {
                errors.push('Password must be at least 8 characters long');
            }
            
            if (password && confirm_password && password !== confirm_password) {
                errors.push('Passwords do not match');
            }
            
            if (errors.length > 0) {
                req.flash('error_msg', errors[0]);
                req.flash('oldInput', req.body);
                return res.redirect('back');
            }
            
            next();
        }
    ];
    
    validateLogin = [
        (req, res, next) => {
            console.log('⚠️  Using fallback login validation');
            const { email, password } = req.body;
            
            if (!email?.trim() || !password) {
                req.flash('error_msg', 'Email and password are required');
                return res.redirect('back');
            }
            
            next();
        }
    ];
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

// Helper to safely apply validator arrays
const applyValidators = (validatorsArray, validatorName) => {
    if (!Array.isArray(validatorsArray)) {
        console.error(`❌ ${validatorName} is not an array, using fallback`);
        return [safeHandler((req, res, next) => next(), `${validatorName}_fallback`)];
    }
    
    return validatorsArray.map((validator, index) => 
        safeHandler(validator, `${validatorName}[${index}]`)
    );
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
            oldInput: req.flash('oldInput')[0] || {},
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
            oldInput: req.flash('oldInput')[0] || {},
            layout: 'layouts/layout'
        });
    }
);

// POST /auth/register - SIMPLIFIED: No role selection needed
router.post('/register', 
    ...applyValidators(validateRegistration, 'validateRegistration'),
    safeHandler(authController.register, 'authController.register')
);

// POST /auth/login
router.post('/login', 
    ...applyValidators(validateLogin, 'validateLogin'),
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

// ==================== TEST ROUTES ====================

// GET /auth/test - Quick test route
router.get('/test', (req, res) => {
    res.json({
        message: 'Auth routes are working',
        user: req.user || 'Not logged in',
        session: req.sessionID ? 'Session exists' : 'No session'
    });
});

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
            validateRegistration: Array.isArray(validateRegistration) ? `array[${validateRegistration.length}]` : typeof validateRegistration,
            validateLogin: Array.isArray(validateLogin) ? `array[${validateLogin.length}]` : typeof validateLogin
        },
        session: {
            id: req.sessionID,
            user: req.user ? 'Logged in' : 'Not logged in'
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