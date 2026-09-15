const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'TRANSFUSION_REMINDER',
      'BLOOD_REQUEST',
      'DONOR_REQUEST',
      'DONOR_ACCEPTED',
      'DONOR_REJECTED',
      'BLOOD_AVAILABLE',
      'BLOOD_UNAVAILABLE',
      'HOSPITAL_ESCALATION',
      'SOCIAL_CAMPAIGN'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  relatedEntity: {
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
