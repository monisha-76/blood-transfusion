const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['MALE', 'FEMALE', 'OTHER'],
    required: true
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
  address: {
    type: String
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true,
    index: true
  },
  diagnosis: {
    type: String,
    default: 'Thalassemia Major'
  },
  medicalHistory: {
    type: String
  },
  patientCondition: {
    type: String,
    default: 'Stable'
  },
  requiredComponent: {
    type: String,
    enum: ['PRBC', 'WHOLE_BLOOD', 'PLATELETS', 'PLASMA'],
    default: 'PRBC'
  },
  medicinesPrescribed: {
    type: String
  },
  medicineDosage: {
    type: String
  },
  medicineFrequency: {
    type: String
  },
  treatmentNotes: {
    type: String
  },
  followUpDate: {
    type: Date
  },
  additionalNotes: {
    type: String
  },
  transfusionFrequency: {
    type: Number, // in days, e.g., 21
    required: true,
    default: 21
  },
  lastTransfusionDate: {
    type: Date,
    required: true
  },
  nextTransfusionDate: {
    type: Date,
    required: true,
    index: true
  },
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  hospital: {
    type: String,
    required: true,
    default: 'City Central Hospital'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Patient', patientSchema);
