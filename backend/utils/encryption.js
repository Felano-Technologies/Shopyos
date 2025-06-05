const crypto = require('crypto');
require('dotenv').config();

// Generate secret key in cmd (openssl rand -hex 32)
const SECRET_KEY = process.env.SECRET_KEY || '067514c0422f3e8cf828119b8e914d30afc368f1c5a33b43b569d6e72ae8ff4e';
const IV_LENGTH = 16; // Initialization vector length for AES

// Function to encrypt the data
const encrypt = async (text) => {
  const iv = crypto.randomBytes(IV_LENGTH); // Generate random initialization vector
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'hex'), iv); // Create cipher
  let encrypted = cipher.update(text, 'utf8', 'hex'); // Encrypt the text
  encrypted += cipher.final('hex'); // Finalize encryption
  return iv.toString('hex') + ':' + encrypted; // Return iv and encrypted text
};

// Function to decrypt the data
const decrypt = async (encryptedText) => {
  const parts = encryptedText.split(':'); // Split iv and encrypted text
  const iv = Buffer.from(parts.shift(), 'hex'); // Get iv from the first part
  const encryptedTextBuffer = Buffer.from(parts.join(':'), 'hex'); // Get encrypted text
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(SECRET_KEY, 'hex'), iv); // Create decipher
  let decrypted = decipher.update(encryptedTextBuffer, 'hex', 'utf8'); // Decrypt the text
  decrypted += decipher.final('utf8'); // Finalize decryption
  return decrypted; // Return decrypted text
};

// // Encrypt a number
// const numberToEncrypt = '1';
// const encryptedNumber = encrypt(numberToEncrypt);
// console.log('Encrypted:', encryptedNumber);

// // Decrypt the number
// const decryptedNumber = decrypt(encryptedNumber);
// console.log('Decrypted:', decryptedNumber);


module.exports = { encrypt, decrypt };