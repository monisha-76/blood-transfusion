const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Donor = require('../models/Donor');
const BloodInventory = require('../models/BloodInventory');
const BloodRequest = require('../models/BloodRequest');
const Transfusion = require('../models/Transfusion');
const Notification = require('../models/Notification');
const SocialCampaign = require('../models/SocialCampaign');
const { calculateNextTransfusionDate } = require('../utils/dateUtils');
const { assignDoctorToPatient } = require('../services/doctorAssignmentService');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeevansetu';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for Seeding...');

    // Clear existing collections
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Doctor.deleteMany({});
    await Donor.deleteMany({});
    await BloodInventory.deleteMany({});
    await BloodRequest.deleteMany({});
    await Transfusion.deleteMany({});
    await Notification.deleteMany({});
    await SocialCampaign.deleteMany({});

    console.log('Cleared existing database records.');

    // 1. Create Seed Users for Admin, Hospital Mgmt, Blood Bank
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@jeevansetu.org',
      password: 'password123',
      role: 'ADMIN',
      phone: '+91-9999900001',
      address: 'JeevanSetu HQ, Central Sector'
    });

    const hospitalUser = await User.create({
      name: 'City Central Management',
      email: 'hospital@jeevansetu.org',
      password: 'password123',
      role: 'HOSPITAL_MANAGEMENT',
      phone: '+91-9999900002',
      address: 'City Central Hospital Tower'
    });

    const bloodBankUser = await User.create({
      name: 'City Central Blood Bank',
      email: 'bloodbank@jeevansetu.org',
      password: 'password123',
      role: 'BLOOD_BANK',
      phone: '+91-9999900005',
      address: 'Main Blood Bank Complex'
    });

    // 2. Create 3 Doctor Users & Profiles for Load-Balancing Verification
    const doc1User = await User.create({
      name: 'Dr. Varma',
      email: 'doctor@jeevansetu.org',
      password: 'password123',
      role: 'DOCTOR',
      phone: '+91-9876543201',
      address: 'Dept of Hematology, City Hospital'
    });
    await Doctor.create({
      userId: doc1User._id,
      name: 'Dr. Varma',
      specialization: 'Hematology',
      hospital: 'City Central Hospital',
      contactNumber: doc1User.phone,
      email: doc1User.email
    });

    const doc2User = await User.create({
      name: 'Dr. Kumar',
      email: 'doctor.kumar@jeevansetu.org',
      password: 'password123',
      role: 'DOCTOR',
      phone: '+91-9876543202',
      address: 'Dept of Pediatric Hematology, City Hospital'
    });
    await Doctor.create({
      userId: doc2User._id,
      name: 'Dr. Kumar',
      specialization: 'Pediatric Hematology',
      hospital: 'City Central Hospital',
      contactNumber: doc2User.phone,
      email: doc2User.email
    });

    const doc3User = await User.create({
      name: 'Dr. Priya',
      email: 'doctor.priya@jeevansetu.org',
      password: 'password123',
      role: 'DOCTOR',
      phone: '+91-9876543203',
      address: 'Dept of Clinical Oncology & Hematology'
    });
    await Doctor.create({
      userId: doc3User._id,
      name: 'Dr. Priya',
      specialization: 'Clinical Hematology',
      hospital: 'City Central Hospital',
      contactNumber: doc3User.phone,
      email: doc3User.email
    });

    console.log('Created 3 Doctor Profiles (Dr. Varma, Dr. Kumar, Dr. Priya).');

    // 3. Create Patient Users & Profiles with Workload Distribution:
    // Dr. Varma -> 2 Patients
    // Dr. Kumar -> 1 Patient (Lowest Load!)
    // Dr. Priya -> 3 Patients

    const today = new Date();
    const lastTrans = new Date(today);
    lastTrans.setDate(lastTrans.getDate() - 11);
    const nextTrans = calculateNextTransfusionDate(lastTrans, 21);

    // Patient 1 (Primary Test Patient: Rohan Verma -> Assigned to Dr. Kumar for 1-patient base)
    const patientUser = await User.create({
      name: 'Rohan Verma',
      email: 'patient@jeevansetu.org',
      password: 'password123',
      role: 'PATIENT',
      phone: '+91-9999900004',
      address: 'Civil Lines, Block B'
    });

    const patientProfile = await Patient.create({
      userId: patientUser._id,
      name: 'Rohan Verma',
      dateOfBirth: new Date('2012-05-15'),
      gender: 'MALE',
      phone: patientUser.phone,
      email: patientUser.email,
      address: patientUser.address,
      bloodGroup: 'B+',
      diagnosis: 'Thalassemia Major',
      medicalHistory: 'Requires PRBC transfusion every 21 days.',
      patientCondition: 'Stable',
      requiredComponent: 'PRBC',
      medicinesPrescribed: 'Deferasirox 500mg, Folic Acid 5mg',
      medicineDosage: '1 tablet daily',
      medicineFrequency: 'Once daily after breakfast',
      treatmentNotes: 'Hemoglobin target > 9.5 g/dL. Iron chelation ongoing.',
      followUpDate: nextTrans,
      transfusionFrequency: 21,
      lastTransfusionDate: lastTrans,
      nextTransfusionDate: nextTrans,
      assignedDoctor: doc2User._id, // Dr. Kumar -> 1
      hospital: 'City Central Hospital'
    });

    // Dr. Varma -> Patient 2 & Patient 3 (2 Patients)
    const p2User = await User.create({ name: 'Monika Sharma', email: 'monika@example.com', password: 'password123', role: 'PATIENT', phone: '+91-9111111111' });
    await Patient.create({
      userId: p2User._id, name: 'Monika Sharma', dateOfBirth: new Date('2015-08-12'), gender: 'FEMALE', phone: p2User.phone, email: p2User.email,
      bloodGroup: 'O-', diagnosis: 'Thalassemia Major', transfusionFrequency: 21, lastTransfusionDate: lastTrans, nextTransfusionDate: nextTrans,
      assignedDoctor: doc1User._id, hospital: 'City Central Hospital'
    });

    const p3User = await User.create({ name: 'Aarav Patel', email: 'aarav@example.com', password: 'password123', role: 'PATIENT', phone: '+91-9222222222' });
    await Patient.create({
      userId: p3User._id, name: 'Aarav Patel', dateOfBirth: new Date('2010-02-20'), gender: 'MALE', phone: p3User.phone, email: p3User.email,
      bloodGroup: 'A+', diagnosis: 'Thalassemia Major', transfusionFrequency: 21, lastTransfusionDate: lastTrans, nextTransfusionDate: nextTrans,
      assignedDoctor: doc1User._id, hospital: 'City Central Hospital'
    });

    // Dr. Priya -> Patient 4, 5, 6 (3 Patients)
    const p4User = await User.create({ name: 'Rahul Singh', email: 'rahul@example.com', password: 'password123', role: 'PATIENT', phone: '+91-9333333333' });
    await Patient.create({
      userId: p4User._id, name: 'Rahul Singh', dateOfBirth: new Date('2011-11-05'), gender: 'MALE', phone: p4User.phone, email: p4User.email,
      bloodGroup: 'AB+', diagnosis: 'Thalassemia Major', transfusionFrequency: 21, lastTransfusionDate: lastTrans, nextTransfusionDate: nextTrans,
      assignedDoctor: doc3User._id, hospital: 'City Central Hospital'
    });

    const p5User = await User.create({ name: 'Sanya Gupta', email: 'sanya@example.com', password: 'password123', role: 'PATIENT', phone: '+91-9444444444' });
    await Patient.create({
      userId: p5User._id, name: 'Sanya Gupta', dateOfBirth: new Date('2016-04-18'), gender: 'FEMALE', phone: p5User.phone, email: p5User.email,
      bloodGroup: 'B-', diagnosis: 'Thalassemia Major', transfusionFrequency: 21, lastTransfusionDate: lastTrans, nextTransfusionDate: nextTrans,
      assignedDoctor: doc3User._id, hospital: 'City Central Hospital'
    });

    const p6User = await User.create({ name: 'Karan Mehra', email: 'karan@example.com', password: 'password123', role: 'PATIENT', phone: '+91-9555555555' });
    await Patient.create({
      userId: p6User._id, name: 'Karan Mehra', dateOfBirth: new Date('2013-09-30'), gender: 'MALE', phone: p6User.phone, email: p6User.email,
      bloodGroup: 'O+', diagnosis: 'Thalassemia Major', transfusionFrequency: 21, lastTransfusionDate: lastTrans, nextTransfusionDate: nextTrans,
      assignedDoctor: doc3User._id, hospital: 'City Central Hospital'
    });

    console.log('Seeded Initial Doctor Workloads: Dr. Varma (2), Dr. Kumar (1), Dr. Priya (3).');

    // 4. Create 6 Registered Donors with varied blood groups
    const donorUser = await User.create({
      name: 'Priya Singh',
      email: 'donor@jeevansetu.org',
      password: 'password123',
      role: 'DONOR',
      phone: '+91-9999900006',
      address: 'Model Town, Phase 1'
    });
    await Donor.create({
      userId: donorUser._id,
      name: 'Priya Singh',
      dateOfBirth: new Date('1998-03-22'),
      bloodGroup: 'B+',
      phone: donorUser.phone,
      email: donorUser.email,
      location: 'Model Town, Phase 1',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-11-10'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 4
    });

    // Donor 2 — O- (Universal Donor)
    await Donor.create({
      name: 'Arvind Kumar',
      bloodGroup: 'O-',
      phone: '+91-9811111101',
      email: 'arvind.donor@example.com',
      location: 'Sector 14, Noida',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-10-05'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 7
    });

    // Donor 3 — A+
    await Donor.create({
      name: 'Sneha Mehta',
      bloodGroup: 'A+',
      phone: '+91-9822222202',
      email: 'sneha.donor@example.com',
      location: 'Rajouri Garden, Delhi',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-09-15'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 3
    });

    // Donor 4 — AB+
    await Donor.create({
      name: 'Rahul Nair',
      bloodGroup: 'AB+',
      phone: '+91-9833333303',
      email: 'rahul.donor@example.com',
      location: 'Lajpat Nagar, Delhi',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-08-20'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 2
    });

    // Donor 5 — O+
    await Donor.create({
      name: 'Ananya Rao',
      bloodGroup: 'O+',
      phone: '+91-9844444404',
      email: 'ananya.donor@example.com',
      location: 'HSR Layout, Bangalore',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-07-10'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 5
    });

    // Donor 6 — B-
    await Donor.create({
      name: 'Vikram Joshi',
      bloodGroup: 'B-',
      phone: '+91-9855555505',
      email: 'vikram.donor@example.com',
      location: 'Baner, Pune',
      availabilityStatus: 'AVAILABLE',
      lastDonationDate: new Date('2025-06-25'),
      verificationStatus: 'ELIGIBLE',
      totalDonations: 1
    });

    console.log('Seeded 6 Donors (B+, O-, A+, AB+, O+, B-) for blood group matching.');

    // 5. Create Blood Inventory Stock
    const expiryFar = new Date(today);
    expiryFar.setDate(expiryFar.getDate() + 30);

    await BloodInventory.create([
      { bloodBank: 'City Central Blood Bank', bloodGroup: 'A+', component: 'PRBC', quantity: 5, reservedQuantity: 0, expiryDate: expiryFar, status: 'AVAILABLE' },
      { bloodBank: 'City Central Blood Bank', bloodGroup: 'O+', component: 'PRBC', quantity: 8, reservedQuantity: 0, expiryDate: expiryFar, status: 'AVAILABLE' },
      { bloodBank: 'City Central Blood Bank', bloodGroup: 'B+', component: 'PRBC', quantity: 2, reservedQuantity: 1, expiryDate: expiryFar, status: 'AVAILABLE' }
    ]);

    // 6. Create Active Blood Request for Rohan Verma (B+) -> Doctor: Dr. Kumar
    const bloodRequest = await BloodRequest.create({
      patient: patientProfile._id,
      doctor: doc2User._id,
      hospital: 'City Central Hospital',
      requiredBloodGroup: 'B+',
      requiredQuantity: 1,
      transfusionDate: nextTrans,
      searchStartDate: today,
      searchEndDate: nextTrans,
      currentStatus: 'PENDING',
      doctorApprovalStatus: 'PENDING',
      source: 'BLOOD_BANK'
    });

    // Create Notification for Dr. Kumar ONLY
    await Notification.create({
      recipient: doc2User._id,
      type: 'BLOOD_REQUEST',
      title: 'New Transfusion Request Pending Review',
      message: `Patient Rohan Verma (B+) submitted a transfusion request for ${nextTrans.toLocaleDateString()}.`,
      relatedEntity: { entityType: 'BloodRequest', entityId: bloodRequest._id }
    });

    console.log('==================================================');
    console.log('DATABASE SEEDED SUCCESSFULLY WITH TEST CREDENTIALS:');
    console.log('==================================================');
    console.log('1. Admin:            admin@jeevansetu.org / password123');
    console.log('2. Hospital Mgmt:    hospital@jeevansetu.org / password123');
    console.log('3. Dr. Varma (2 pts):doctor@jeevansetu.org / password123');
    console.log('4. Dr. Kumar (1 pt): doctor.kumar@jeevansetu.org / password123');
    console.log('5. Dr. Priya (3 pts):doctor.priya@jeevansetu.org / password123');
    console.log('6. Patient:          patient@jeevansetu.org / password123');
    console.log('7. Blood Bank:       bloodbank@jeevansetu.org / password123');
    console.log('8. Donor:            donor@jeevansetu.org / password123');
    console.log('==================================================');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
