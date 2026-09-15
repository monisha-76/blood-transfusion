const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true,
    index: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    index: true
  },
  availabilityStatus: {
    type: String,
    enum: ['AVAILABLE', 'UNAVAILABLE'],
    default: 'AVAILABLE',
    index: true
  },
  lastDonationDate: {
    type: Date
  },
  verificationStatus: {
    type: String,
    enum: ['PENDING_VERIFICATION', 'ELIGIBLE', 'INELIGIBLE', 'ACTIVE', 'INACTIVE'],
    default: 'ELIGIBLE',
    index: true
  },
  healthDeclaration: {
    type: Boolean,
    default: true
  },
  consent: {
    type: Boolean,
    default: true
  },
  willingToDonate: {
    type: Boolean,
    default: true,
    index: true
  },
  totalDonations: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Donor', donorSchema);
