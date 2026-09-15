const mongoose = require('mongoose');

const socialCampaignSchema = new mongoose.Schema({
  bloodRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodRequest',
    required: true,
    index: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  requiredQuantity: {
    type: Number,
    required: true
  },
  hospital: {
    type: String,
    required: true
  },
  requiredDate: {
    type: Date,
    required: true
  },
  postContent: {
    title: String,
    body: String,
    hashtags: [String],
    registrationUrl: String
  },
  officialAccounts: {
    instagram: String,
    facebook: String,
    twitter: String,
    whatsapp: String
  },
  contactDetails: {
    phone: String,
    email: String,
    contactPerson: String
  },
  status: {
    type: String,
    enum: [
      'POST_CREATED',
      'POST_READY',
      'POST_PUBLISHED',
      'POST_FAILED',
      'FULFILLED',
      'EXPIRED'
    ],
    default: 'POST_CREATED',
    index: true
  },
  platformPosts: [{
    platform: String,
    postId: String,
    postUrl: String,
    status: {
      type: String,
      enum: ['POST_CREATED', 'POST_READY', 'POST_PUBLISHED', 'POST_FAILED', 'FULFILLED'],
      default: 'POST_READY'
    },
    publishedAt: Date,
    errorMessage: String
  }],
  expiryDate: {
    type: Date,
    required: true
  },
  publishedAt: {
    type: Date
  },
  fulfilledAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SocialCampaign', socialCampaignSchema);
