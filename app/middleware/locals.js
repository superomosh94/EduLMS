// middleware/locals.js
module.exports = function(req, res, next) {
  // Make currentUser available to all views
  res.locals.currentUser = req.user || null;
  next();
};