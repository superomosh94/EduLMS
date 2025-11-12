const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { pool } = require('./database');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy(
      { 
        usernameField: 'email',
        passReqToCallback: true 
      }, 
      async (req, email, password, done) => {
        try {
          console.log(`🔐 Passport login attempt for: ${email}`);
          
          // FIXED: Use pool.query() instead of db.query()
          const [users] = await pool.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ? AND u.is_active = 1`,
            [email]
          );

          if (users.length === 0) {
            console.log('❌ No account found with email:', email);
            req.flash('error_msg', 'No account found with that email address');
            return done(null, false);
          }

          const user = users[0];
          console.log(`✅ User found: ${user.name} (${user.role_name})`);

          // Check password
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            console.log('❌ Password incorrect for user:', email);
            req.flash('error_msg', 'Password is incorrect');
            return done(null, false);
          }

          console.log('✅ Password verified successfully');

          // Update last login
          await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
          );

          // Log login activity
          try {
            await pool.query(
              `INSERT INTO audit_logs (user_id, action, table_name, record_id, ip_address, user_agent) 
               VALUES (?, 'login', 'users', ?, ?, ?)`,
              [user.id, user.id, req.ip, req.get('User-Agent') || 'Unknown']
            );
            console.log('📝 Login activity logged');
          } catch (logError) {
            console.warn('⚠️ Could not log login activity (table might not exist):', logError.message);
          }

          console.log(`✅ Login successful for: ${user.name}`);
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
      console.log(`🔍 Deserializing user ID: ${id}`);
      
      // FIXED: Use pool.query() instead of db.query()
      const [users] = await pool.query(
        `SELECT u.*, r.name as role_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         WHERE u.id = ?`,
        [id]
      );
      
      if (users.length === 0) {
        console.log('❌ User not found during deserialization:', id);
        return done(null, false);
      }
      
      const user = users[0];
      
      // Remove password from user object
      const { password, ...userWithoutPassword } = user;
      console.log(`✅ User deserialized: ${userWithoutPassword.name} (${userWithoutPassword.role_name})`);
      done(null, userWithoutPassword);
    } catch (err) {
      console.error('❌ Passport deserialize error:', err);
      done(err);
    }
  });
};