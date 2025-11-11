const express = require('express');
const router = express.Router();

// Import controllers and middleware
const studentController = require('../controllers/users/studentController');
const { ensureAuthenticated, requireStudent } = require('../middleware/auth');
const { uploadSubmission } = require('../middleware/upload');

// Apply student middleware to all routes
router