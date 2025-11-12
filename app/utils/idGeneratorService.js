const crypto = require('crypto');

// Generate a random unique ID with prefix and length
function generateId(prefix = 'ID', length = 8) {
  const randomPart = crypto.randomBytes(length).toString('hex').slice(0, length);
  return `${prefix}-${randomPart.toUpperCase()}`;
}

module.exports = { generateId };
