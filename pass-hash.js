const bcrypt = require('bcrypt');
const hash = '$2a$12$EN2D6gubq3pgpYqsJOqajOHJ06WWUqskmFEKKY6ofIyI4jGVCxW2q';
const password = 'Senior@1';

bcrypt.compare(password, hash)
.then(match => {
if (match) console.log('MATCH: password equals hash');
else console.log('NO MATCH: password does not equal hash');
})
.catch(err => {
console.error('Error verifying password', err);
});