const mongoose = require('mongoose');

const donorMatchSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donor',
    required: true,
    index: true
  },
  bloodRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true
  },
  matchStatus: {
    type: String,
    enum: ['MATCHED', 'NOTIFIED', 'RESPONDED', 'COMPLETED', 'CANCELLED'],
    default: 'MATCHED'
  },
  notificationStatus: {
    type: String,
    enum: ['PENDING', 'EMAIL_SENT', 'EMAIL_FAILED'],
    default: 'PENDING'
  },
  donorResponse: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING'
  },
  donationStatus: {
    type: String,
    enum: ['PENDING', 'SCHEDULED', 'DONATED', 'CONFIRMED', 'CANCELLED'],
    default: 'PENDING'
  },
  notifiedAt: {
    type: Date
  },
  respondedAt: {
    type: Date
  },
  confirmedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate matches and duplicate notifications for the same donor + blood request
donorMatchSchema.index({ donorId: 1, bloodRequestId: 1 }, { unique: true });

module.exports = mongoose.model('DonorMatch', donorMatchSchema);
