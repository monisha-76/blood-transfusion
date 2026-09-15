const mongoose = require('mongoose');

const transfusionSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bloodRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BloodRequest',
    required: true
  },
  transfusionDate: {
    type: Date,
    required: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    enum: ['BLOOD_BANK', 'REGISTERED_DONOR', 'PUBLIC_DONOR'],
    required: true
  },
  status: {
    type: String,
    enum: ['SCHEDULED', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    default: 'SCHEDULED'
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transfusion', transfusionSchema);
