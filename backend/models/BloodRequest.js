const mongoose = require('mongoose');

const donorResponseSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donor',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING'
  },
  notifiedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  }
});

const bloodRequestSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hospital: {
    type: String,
    required: true,
    default: 'City Central Hospital'
  },
  requiredBloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true,
    index: true
  },
  requiredQuantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  securedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingQuantity: {
    type: Number,
    default: function() {
      return this.requiredQuantity || 1;
    },
    min: 0
  },
  transfusionDate: {
    type: Date,
    required: true,
    index: true
  },
  searchStartDate: {
    type: Date,
    required: true
  },
  searchEndDate: {
    type: Date,
    required: true
  },
  currentStatus: {
    type: String,
    enum: [
      'PENDING',
      'ACTIVE',
      'INVENTORY_CHECK',
      'DONOR_SEARCH',
      'DONOR_NOTIFICATION',
      'PUBLIC_RECRUITMENT',
      'BLOOD_AVAILABLE',
      'BLOOD_SECURED',
      'RESERVED',
      'DOCTOR_APPROVAL',
      'READY_FOR_TRANSFUSION',
      'COMPLETED',
      'UNAVAILABLE_ESCALATED',
      'CANCELLED',
      'EXPIRED'
    ],
    default: 'ACTIVE',
    index: true
  },
  socialCampaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialCampaign'
  },
  source: {
    type: String,
    enum: ['BLOOD_BANK', 'REGISTERED_DONOR', 'PUBLIC_DONOR', 'UNASSIGNED'],
    default: 'UNASSIGNED'
  },
  donorResponses: [donorResponseSchema],
  matchedDonorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Donor'
  },
  reservedInventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodInventory'
  },
  doctorApprovalStatus: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  doctorApprovalDate: {
    type: Date
  },
  doctorNotes: {
    type: String
  },
  escalatedAt: {
    type: Date
  },
  lateAvailableAt: {
    type: Date
  }
}, {
  timestamps: true
});

bloodRequestSchema.pre('save', function(next) {
  if (this.requiredQuantity !== undefined) {
    this.remainingQuantity = Math.max(0, this.requiredQuantity - (this.securedQuantity || 0));
  }
  next();
});

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);
