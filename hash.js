// hash.js
const bcrypt = require('bcrypt');

// Get password from command line
const password = process.argv[2];

if (!password) {
  console.log("Usage: node hash.js <password>");
  process.exit(1);
}

// Number of salt rounds (higher = more secure, but slower)
const saltRounds = 10;

// Hash the password
bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error("Error generating hash:", err);
    process.exit(1);
  }

  console.log("Password:", password);
  console.log("Hashed Password:", hash);
});
