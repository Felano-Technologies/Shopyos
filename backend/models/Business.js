const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const businessSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  ownerName: String,
  businessType: String,
  country: String,
  address: String,
  socialMedia: String,
  productCategory: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  longitude: {
    type: Number,
    default: null,
  },
  latitude: {
    type: Number,
    default: null,
  },
}, { timestamps: true });

// Password hashing middleware
businessSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with hashed password
businessSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;