// models/Business.js
const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  // Owner reference
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  //i added this part to make email unique but optional... 
  email: {
    type: String,
    unique: true, 
    sparse: true, // <--- ADD THIS! This allows multiple documents to have no email.
    trim: true,
  },
  // Basic business info
  businessName: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  },
  
  // Contact information
  phone: { 
    type: String, 
    required: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  city: { 
    type: String, 
    required: true 
  },
  country: { 
    type: String, 
    required: true 
  },
  
  // Optional fields
  website: { 
    type: String, 
    default: '' 
  },
  socialMedia: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' }
  },
  
  // Images (Cloudinary URLs)
  logo: { 
    type: String, 
    default: '' 
  },
  coverImage: { 
    type: String, 
    default: '' 
  },
  
  // Verification and status
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Business metrics
  rating: {
    type: Number,
    default: 0
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalProducts: {
    type: Number,
    default: 0
  },
  totalOrders: {
    type: Number,
    default: 0
  }

}, { 
  timestamps: true 
});

// Index for better query performance
businessSchema.index({ owner: 1, businessName: 1 });
businessSchema.index({ category: 1 });
businessSchema.index({ verificationStatus: 1 });

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;