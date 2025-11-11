// Validators index file for easy imports

const userValidators = require('./userValidators');
const courseValidators = require('./courseValidators');
const assignmentValidators = require('./assignmentValidators');
const paymentValidators = require('./paymentValidators');
const gradeValidators = require('./gradeValidators');

module.exports = {
  userValidators,
  courseValidators,
  assignmentValidators,
  paymentValidators,
  gradeValidators
};