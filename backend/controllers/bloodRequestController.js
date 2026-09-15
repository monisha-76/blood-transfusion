const BloodRequest = require('../models/BloodRequest');
const Patient = require('../models/Patient');
const { initiateBloodSearch, process7DayEscalation } = require('../services/bloodSearchService');

// @desc    Get blood requests with strict RBAC filtering
// @route   GET /api/blood-requests
// @access  Private
const getAllRequests = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === 'PATIENT') {
      const myPatient = await Patient.findOne({
        $or: [{ userId: req.user._id }, { email: req.user.email.toLowerCase().trim() }]
      });
      if (!myPatient) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      query = { patient: myPatient._id };
    } else if (req.user.role === 'DOCTOR') {
      const myPatients = await Patient.find({ assignedDoctor: req.user._id }).select('_id');
      const patientIds = myPatients.map(p => p._id);
      query = { patient: { $in: patientIds } };
    }

    const requests = await BloodRequest.find(query)
      .populate('patient')
      .populate('doctor')
      .populate('matchedDonorId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get blood request by ID with RBAC check
// @route   GET /api/blood-requests/:id
// @access  Private
const getRequestById = async (req, res, next) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('patient')
      .populate('doctor')
      .populate('matchedDonorId')
      .populate('donorResponses.donorId');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Blood request not found' });
    }

    // RBAC Checks
    if (req.user.role === 'PATIENT') {
      const myPatient = await Patient.findOne({ userId: req.user._id });
      if (!myPatient || request.patient?._id.toString() !== myPatient._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to blood request' });
      }
    } else if (req.user.role === 'DOCTOR') {
      if (request.patient?.assignedDoctor?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to blood request' });
      }
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually create a blood request
// @route   POST /api/blood-requests
// @access  Private (Doctor, Patient, Hospital Mgmt, Admin)
const createRequest = async (req, res, next) => {
  try {
    const { patientId, hospital, requiredBloodGroup, requiredQuantity, transfusionDate } = req.body;

    let targetPatient = null;
    if (req.user.role === 'PATIENT') {
      targetPatient = await Patient.findOne({ userId: req.user._id });
    } else {
      targetPatient = await Patient.findById(patientId);
    }

    if (!targetPatient) {
      return res.status(404).json({ success: false, message: 'Patient profile not found' });
    }

    const reqTransDate = new Date(transfusionDate || targetPatient.nextTransfusionDate);
    const searchStartDate = new Date();
    const searchEndDate = new Date(reqTransDate);

    const request = await BloodRequest.create({
      patient: targetPatient._id,
      doctor: targetPatient.assignedDoctor || req.user._id,
      hospital: hospital || targetPatient.hospital || 'City Central Hospital',
      requiredBloodGroup: requiredBloodGroup || targetPatient.bloodGroup,
      requiredQuantity: requiredQuantity || 1,
      transfusionDate: reqTransDate,
      searchStartDate,
      searchEndDate,
      currentStatus: 'PENDING'
    });

    // Launch 4-Level procurement search pipeline immediately
    const searchResult = await initiateBloodSearch(request._id);

    res.status(201).json({
      success: true,
      message: 'Blood request created and procurement workflow launched',
      data: { request, searchResult }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Re-trigger search for a request
// @route   POST /api/blood-requests/:id/search
// @access  Private
const triggerProcurementSearch = async (req, res, next) => {
  try {
    const searchResult = await initiateBloodSearch(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Procurement search re-executed',
      data: searchResult
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get 7-day escalated cases
// @route   GET /api/blood-requests/escalated
// @access  Private (Hospital Mgmt, Admin)
const getEscalatedCases = async (req, res, next) => {
  try {
    const cases = await BloodRequest.find({ currentStatus: 'UNAVAILABLE_ESCALATED' })
      .populate('patient')
      .populate('doctor')
      .sort({ escalatedAt: -1 });

    res.status(200).json({
      success: true,
      count: cases.length,
      data: cases
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllRequests,
  getRequestById,
  createRequest,
  triggerProcurementSearch,
  getEscalatedCases
};
