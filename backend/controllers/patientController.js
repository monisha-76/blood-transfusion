const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Transfusion = require('../models/Transfusion');
const BloodRequest = require('../models/BloodRequest');
const { calculateNextTransfusionDate } = require('../utils/dateUtils');
const { trigger10DayBloodSearch } = require('../services/transfusionScheduler');
const { assignDoctorToPatient } = require('../services/doctorAssignmentService');

// @desc    Create or update patient profile
// @route   POST /api/patients
// @access  Private (Patient / Admin / Doctor)
const createPatientProfile = async (req, res, next) => {
  try {
    const {
      name, dateOfBirth, gender, phone, email, address,
      bloodGroup, diagnosis, medicalHistory, transfusionFrequency,
      lastTransfusionDate, assignedDoctor, hospital,
      patientCondition, requiredComponent, medicinesPrescribed,
      medicineDosage, medicineFrequency, treatmentNotes, followUpDate, additionalNotes
    } = req.body;

    let targetUserId = req.user.role === 'PATIENT' ? req.user._id : req.body.userId;

    // If created by Doctor/Admin, find or create the Patient User account by email
    if (req.user.role !== 'PATIENT' && !targetUserId && email) {
      let patientUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (!patientUser) {
        patientUser = await User.create({
          name: name || 'Patient User',
          email: email.toLowerCase().trim(),
          password: 'password123',
          role: 'PATIENT',
          phone,
          address
        });
      }
      targetUserId = patientUser._id;
    }

    if (!targetUserId) {
      targetUserId = req.user._id;
    }

    const freq = parseInt(transfusionFrequency, 10) || 21;
    const lastDate = lastTransfusionDate ? new Date(lastTransfusionDate) : new Date();
    const nextDate = calculateNextTransfusionDate(lastDate, freq);

    let patient = await Patient.findOne({
      $or: [{ userId: targetUserId }, { email: email?.toLowerCase().trim() }]
    });

    const docAssignment = assignedDoctor || (req.user.role === 'DOCTOR' ? req.user._id : undefined);

    if (patient) {
      patient.userId = targetUserId;
      patient.name = name || patient.name;
      patient.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : patient.dateOfBirth;
      patient.gender = gender || patient.gender;
      patient.phone = phone || patient.phone;
      patient.email = email || patient.email;
      patient.address = address || patient.address;
      patient.bloodGroup = bloodGroup || patient.bloodGroup;
      patient.diagnosis = diagnosis || patient.diagnosis;
      patient.medicalHistory = medicalHistory || patient.medicalHistory;
      if (patientCondition) patient.patientCondition = patientCondition;
      if (requiredComponent) patient.requiredComponent = requiredComponent;
      if (medicinesPrescribed !== undefined) patient.medicinesPrescribed = medicinesPrescribed;
      if (medicineDosage !== undefined) patient.medicineDosage = medicineDosage;
      if (medicineFrequency !== undefined) patient.medicineFrequency = medicineFrequency;
      if (treatmentNotes !== undefined) patient.treatmentNotes = treatmentNotes;
      if (followUpDate) patient.followUpDate = new Date(followUpDate);
      if (additionalNotes !== undefined) patient.additionalNotes = additionalNotes;
      patient.transfusionFrequency = freq;
      patient.lastTransfusionDate = lastDate;
      patient.nextTransfusionDate = nextDate;
      if (docAssignment) patient.assignedDoctor = docAssignment;
      patient.hospital = hospital || patient.hospital;

      await patient.save();
    } else {
      patient = await Patient.create({
        userId: targetUserId,
        name: name || req.user.name,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('2000-01-01'),
        gender: gender || 'MALE',
        phone: phone || req.user.phone || '+91-9876543210',
        email: email || req.user.email,
        address: address || req.user.address || 'City Center',
        bloodGroup: bloodGroup || 'B+',
        diagnosis: diagnosis || 'Thalassemia Major',
        medicalHistory,
        patientCondition: patientCondition || 'Stable',
        requiredComponent: requiredComponent || 'PRBC',
        medicinesPrescribed,
        medicineDosage,
        medicineFrequency,
        treatmentNotes,
        followUpDate: followUpDate ? new Date(followUpDate) : undefined,
        additionalNotes,
        transfusionFrequency: freq,
        lastTransfusionDate: lastDate,
        nextTransfusionDate: nextDate,
        assignedDoctor: docAssignment,
        hospital: hospital || 'City Central Hospital'
      });
    }

    // If no assigned doctor set yet, dynamically assign lowest-workload doctor
    if (!patient.assignedDoctor) {
      await assignDoctorToPatient(patient._id);
    }

    res.status(201).json({
      success: true,
      message: 'Patient profile saved & synced successfully',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current patient profile with populated My Doctor details
// @route   GET /api/patients/me
// @access  Private (Patient)
const getMyPatientProfile = async (req, res, next) => {
  try {
    let patient = await Patient.findOne({
      $or: [{ userId: req.user._id }, { email: req.user.email.toLowerCase().trim() }]
    }).populate('assignedDoctor', 'name email phone address');

    if (!patient) {
      return res.status(200).json({
        success: true,
        data: {
          patient: null,
          assignedDoctorDetails: null,
          activeBloodRequest: null,
          transfusionHistory: []
        }
      });
    }

    // Ensure userId is linked if missing
    if (!patient.userId || patient.userId.toString() !== req.user._id.toString()) {
      patient.userId = req.user._id;
      await patient.save();
    }

    // If doctor not assigned yet, dynamically assign lowest-workload doctor
    if (!patient.assignedDoctor) {
      const assignedDocUser = await assignDoctorToPatient(patient._id);
      if (assignedDocUser) {
        patient = await Patient.findById(patient._id).populate('assignedDoctor', 'name email phone address');
      }
    }

    // Fetch extra Doctor profile info (specialization, hospital, contactNumber)
    let assignedDoctorDetails = null;
    if (patient.assignedDoctor) {
      const docProfile = await Doctor.findOne({ userId: patient.assignedDoctor._id });
      assignedDoctorDetails = {
        id: patient.assignedDoctor._id,
        name: patient.assignedDoctor.name,
        email: patient.assignedDoctor.email,
        phone: docProfile?.contactNumber || patient.assignedDoctor.phone || '+91-9876543210',
        specialization: docProfile?.specialization || 'Hematology',
        hospital: docProfile?.hospital || patient.hospital || 'City Central Hospital',
        status: 'Active'
      };
    }

    const activeBloodRequest = await BloodRequest.findOne({
      patient: patient._id,
      currentStatus: { $ne: 'COMPLETED' }
    }).sort({ createdAt: -1 });

    const transfusionHistory = await Transfusion.find({ patient: patient._id }).sort({ transfusionDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        patient,
        assignedDoctorDetails,
        activeBloodRequest,
        transfusionHistory
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update medical information for assigned patient (Doctor/Admin)
// @route   PUT /api/patients/:id/medical-records
// @access  Private (Doctor, Admin)
const updatePatientMedicalRecords = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient record not found' });
    }

    // RBAC Check: Doctor can only update their assigned patients
    if (req.user.role === 'DOCTOR' && patient.assignedDoctor && patient.assignedDoctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You are not the assigned doctor for this patient.' });
    }

    const {
      patientCondition, diagnosis, medicalHistory, bloodGroup,
      requiredComponent, medicinesPrescribed, medicineDosage,
      medicineFrequency, treatmentNotes, followUpDate, additionalNotes,
      lastTransfusionDate, transfusionFrequency
    } = req.body;

    if (patientCondition) patient.patientCondition = patientCondition;
    if (diagnosis) patient.diagnosis = diagnosis;
    if (medicalHistory !== undefined) patient.medicalHistory = medicalHistory;
    if (bloodGroup) patient.bloodGroup = bloodGroup;
    if (requiredComponent) patient.requiredComponent = requiredComponent;
    if (medicinesPrescribed !== undefined) patient.medicinesPrescribed = medicinesPrescribed;
    if (medicineDosage !== undefined) patient.medicineDosage = medicineDosage;
    if (medicineFrequency !== undefined) patient.medicineFrequency = medicineFrequency;
    if (treatmentNotes !== undefined) patient.treatmentNotes = treatmentNotes;
    if (followUpDate) patient.followUpDate = new Date(followUpDate);
    if (additionalNotes !== undefined) patient.additionalNotes = additionalNotes;

    if (transfusionFrequency) patient.transfusionFrequency = parseInt(transfusionFrequency, 10);
    if (lastTransfusionDate) {
      patient.lastTransfusionDate = new Date(lastTransfusionDate);
      patient.nextTransfusionDate = calculateNextTransfusionDate(patient.lastTransfusionDate, patient.transfusionFrequency);
    }

    await patient.save();

    res.status(200).json({
      success: true,
      message: 'Medical information & treatment plan updated successfully',
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all patients (Doctor gets assigned patients, Admin gets all)
// @route   GET /api/patients
// @access  Private (Doctor, Admin, Hospital Mgmt)
const getAllPatients = async (req, res, next) => {
  try {
    let query = {};
    if (req.user.role === 'DOCTOR') {
      query = { assignedDoctor: req.user._id };
    }

    const patients = await Patient.find(query).populate('assignedDoctor', 'name specialization email phone');
    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private
const getPatientById = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id).populate('assignedDoctor');
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // RBAC: Doctor can only access assigned patient
    if (req.user.role === 'DOCTOR' && patient.assignedDoctor && patient.assignedDoctor._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to patient profile' });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPatientProfile,
  getMyPatientProfile,
  updatePatientMedicalRecords,
  getAllPatients,
  getPatientById
};
