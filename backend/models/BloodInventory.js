const mongoose = require('mongoose');

const bloodInventorySchema = new mongoose.Schema({
  bloodBank: {
    type: String,
    required: true,
    default: 'City Central Blood Bank'
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true,
    index: true
  },
  component: {
    type: String,
    enum: ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'PLASMA'],
    default: 'PRBC'
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative']
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Reserved quantity cannot be negative']
  },
  expiryDate: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'RESERVED', 'EXPIRED'],
    default: 'AVAILABLE',
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BloodInventory', bloodInventorySchema);
