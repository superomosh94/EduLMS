const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./database');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy(
      { 
        usernameField: 'email',
        passReqToCallback: true 
      }, 
      async (req, email, password, done) => {
        try {
          // Get user by email with role information
          const users = await db.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ? AND u.is_active = 1`,
            [email]
          );

          if (users.length === 0) {
            req.flash('error_msg', 'No account found with that email address');
            return done(null, false);
          }

          const user = users[0];

          // Check password
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            req.flash('error_msg', 'Password is incorrect');
            return done(null, false);
          }

          // Update last login
          await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
          );

          // Log login activity
          await db.query(
            `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
             VALUES (?, 'login', 'users', ?, ?, ?)`,
            [user.id, user.id, req.ip, req.get('User-Agent')]
          );

          return done(null, user);
        } catch (err) {
          console.error('❌ Passport login error:', err);
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const users = await db.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [id]
      );
      
      if (users.length === 0) {
        return done(null, false);
      }
      
      const user = users[0];
      
      // Remove password from user object
      const { password, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (err) {
      console.error('❌ Passport deserialize error:', err);
      done(err);
    }
  });
};