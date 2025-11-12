const passport = require('passport');
const bcrypt = require('bcryptjs'); // CHANGED: Use bcryptjs for consistency
const User = require('../../models/User');

const authController = {
  // Show login page
  showLogin: (req, res) => {
    res.render('auth/login', {
      title: 'Login - EduLMS',
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg'),
      oldInput: req.flash('oldInput')[0] || {}
    });
  },

  // Show register page
  showRegister: (req, res) => {
    res.render('auth/register', {
      title: 'Register - EduLMS',
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg'),
      oldInput: req.flash('oldInput')[0] || {}
    });
  },

  // Handle user registration - REMOVED PASSWORD HASHING (let User model handle it)
  register: async (req, res) => {
    try {
      const { first_name, last_name, email, password, phone } = req.body;

      console.log('🔍 Registration attempt:', { 
        first_name, last_name, email, 
        phone: phone || 'not provided',
        password_length: password ? password.length : 0
      });

      // Check if user already exists
      console.log('🔎 Checking if user exists with email:', email);
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.log('❌ User already exists with email:', email);
        req.flash('error_msg', 'Email is already registered');
        req.flash('oldInput', req.body);
        return res.redirect('/auth/register');
      }
      console.log('✅ Email is available');

      // Combine first_name and last_name into a single name field
      const name = `${first_name} ${last_name}`.trim();
      console.log('👤 Combined name:', name);

      // CHANGED: Don't hash password here - let User.create() handle it
      console.log('🔐 Password will be hashed by User model...');

      // Create user with PLAIN password - User.create() will hash it
      const userData = {
        name,
        email,
        password: password, // Plain password - User.create() handles hashing
        phone: phone || null,
        role_id: 3, // Default to student role
        email_verified: true // Auto-verify for now
      };

      console.log('📝 Creating user with data:', { ...userData, password: '[PLAIN - will be hashed by User model]' });

      // Create user - User.create() will handle password hashing internally
      const userId = await User.create(userData);
      console.log('✅ User created successfully with ID:', userId);

      console.log('🎉 Registration completed successfully!');
      
      req.flash('success_msg', 'Registration successful! You can now login.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('💥 Registration error:', error);
      req.flash('error_msg', error.message || 'Registration failed. Please try again.');
      req.flash('oldInput', req.body);
      res.redirect('/auth/register');
    }
  },

  // Handle user login (Passport handles the password comparison)
  login: (req, res, next) => {
    console.log('🔐 Login attempt for:', req.body.email);
    
    passport.authenticate('local', (err, user, info) => {
      if (err) {
        console.error('❌ Passport authentication error:', err);
        req.flash('error_msg', 'Authentication error. Please try again.');
        return res.redirect('/auth/login');
      }

      if (!user) {
        console.log('❌ Authentication failed - no user returned');
        const errorMessage = req.flash('error_msg')[0] || 'Invalid email or password';
        req.flash('error_msg', errorMessage);
        req.flash('oldInput', { email: req.body.email });
        return res.redirect('/auth/login');
      }

      req.logIn(user, (err) => {
        if (err) {
          console.error('❌ Login session error:', err);
          req.flash('error_msg', 'Login failed. Please try again.');
          return res.redirect('/auth/login');
        }

        console.log('✅ User logged in successfully:', user.email);
        console.log('👤 User role:', user.role_name);
        
        // Redirect based on role
        const redirectPath = getRedirectPath(user.role_id);
        req.flash('success_msg', `Welcome back, ${user.name || user.email}!`);
        return res.redirect(redirectPath);
      });
    })(req, res, next);
  },

  // Handle user logout
  logout: (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return next(err);
      }
      req.flash('success_msg', 'You have been logged out successfully.');
      res.redirect('/auth/login');
    });
  },

  // Verify email (simplified - auto-verify for now)
  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;
      console.log('Email verification attempt with token:', token);
      
      // Auto-verify for development
      req.flash('success_msg', 'Email verified successfully! You can now login.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Email verification error:', error);
      req.flash('error_msg', 'Email verification failed. Please try again.');
      res.redirect('/auth/login');
    }
  },

  // Resend verification email (simulated)
  resendVerification: async (req, res) => {
    try {
      const { email } = req.body;
      console.log('Resend verification requested for:', email);
      
      // Simulate email sending
      console.log('📧 Verification email would be sent to:', email);
      
      req.flash('success_msg', 'Verification email sent! Please check your inbox.');
      res.redirect('/auth/login');

    } catch (error) {
      console.error('Resend verification error:', error);
      req.flash('error_msg', 'Failed to send verification email. Please try again.');
      res.redirect('/auth/verify-email');
    }
  }
};

// Helper function to determine redirect path based on role
function getRedirectPath(roleId) {
  switch (parseInt(roleId)) {
    case 1: // Admin
      return '/admin/dashboard';
    case 2: // Instructor
      return '/instructor/dashboard';
    case 3: // Student
      return '/student/dashboard';
    case 4: // Finance
      return '/finance/dashboard';
    default:
      return '/dashboard';
  }
}

module.exports = authController;