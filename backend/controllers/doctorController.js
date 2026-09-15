const Patient = require('../models/Patient');
const BloodRequest = require('../models/BloodRequest');
const Transfusion = require('../models/Transfusion');
const BloodInventory = require('../models/BloodInventory');
const { calculateNextTransfusionDate } = require('../utils/dateUtils');
const { createNotification } = require('../services/notificationService');

// @desc    Get patients assigned ONLY to logged-in doctor
// @route   GET /api/doctors/patients
// @access  Private (Doctor)
const getAssignedPatients = async (req, res, next) => {
  try {
    const query = req.user.role === 'ADMIN' ? {} : { assignedDoctor: req.user._id };
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

// @desc    Get ACTIVE blood requests for assigned patients — sorted by transfusion date ASC (excludes COMPLETED & CANCELLED)
// @route   GET /api/doctors/approvals
// @access  Private (Doctor, Admin)
const getPendingApprovals = async (req, res, next) => {
  try {
    let patientIds = null;
    if (req.user.role === 'DOCTOR') {
      const myPatients = await Patient.find({ assignedDoctor: req.user._id }).select('_id');
      patientIds = myPatients.map(p => p._id);
    }

    const baseQuery = patientIds ? { patient: { $in: patientIds } } : {};

    // Only return ACTIVE requests — hide COMPLETED and CANCELLED
    const query = {
      ...baseQuery,
      currentStatus: { $nin: ['COMPLETED', 'CANCELLED'] }
    };

    const requests = await BloodRequest.find(query)
      .populate('patient')
      .populate('doctor')
      .sort({ transfusionDate: 1 }); // ASC — soonest transfusion first

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
};

// @desc    Doctor confirms blood is secured (BLOOD_AVAILABLE → READY_FOR_TRANSFUSION)
// @route   POST /api/doctors/confirm-blood-secured
// @access  Private (Doctor)
const confirmBloodSecured = async (req, res, next) => {
  try {
    const { bloodRequestId } = req.body;
    if (!bloodRequestId) {
      return res.status(400).json({ success: false, message: 'bloodRequestId required' });
    }

    const bloodRequest = await BloodRequest.findById(bloodRequestId).populate('patient');
    if (!bloodRequest) {
      return res.status(404).json({ success: false, message: 'Blood request not found' });
    }

    // RBAC
    if (req.user.role === 'DOCTOR' && bloodRequest.patient?.assignedDoctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    bloodRequest.currentStatus = 'READY_FOR_TRANSFUSION';
    bloodRequest.doctorApprovalStatus = 'APPROVED';
    bloodRequest.doctorApprovalDate = new Date();
    await bloodRequest.save();

    // Create Transfusion record
    await Transfusion.create({
      patient: bloodRequest.patient._id,
      doctor: req.user._id,
      bloodRequest: bloodRequest._id,
      transfusionDate: bloodRequest.transfusionDate,
      bloodGroup: bloodRequest.requiredBloodGroup,
      quantity: bloodRequest.requiredQuantity,
      source: bloodRequest.source || 'BLOOD_BANK',
      status: 'APPROVED'
    });

    // Notify patient
    if (bloodRequest.patient?.userId) {
      await createNotification({
        recipientId: bloodRequest.patient.userId,
        type: 'BLOOD_AVAILABLE',
        title: 'Blood Secured – Transfusion Ready!',
        message: `Dr. ${req.user.name} confirmed blood is secured for your transfusion on ${new Date(bloodRequest.transfusionDate).toLocaleDateString()}. Please arrive at ${bloodRequest.hospital}.`,
        relatedEntity: { entityType: 'BloodRequest', entityId: bloodRequest._id }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Blood confirmed as secured. Status set to Ready for Transfusion.',
      data: bloodRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve or reject blood request (kept for compatibility)
// @route   POST /api/doctors/approve-transfusion
// @access  Private (Doctor)
const approveTransfusion = async (req, res, next) => {
  try {
    const { bloodRequestId, action, doctorNotes } = req.body;

    if (!bloodRequestId || !action) {
      return res.status(400).json({ success: false, message: 'Provide bloodRequestId and action' });
    }

    const bloodRequest = await BloodRequest.findById(bloodRequestId).populate('patient');
    if (!bloodRequest) {
      return res.status(404).json({ success: false, message: 'Blood request not found' });
    }

    if (req.user.role === 'DOCTOR' && bloodRequest.patient?.assignedDoctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    if (action === 'APPROVE') {
      bloodRequest.doctorApprovalStatus = 'APPROVED';
      bloodRequest.doctorApprovalDate = new Date();
      bloodRequest.doctorNotes = doctorNotes || 'Approved for clinical transfusion procedure.';
      bloodRequest.currentStatus = 'READY_FOR_TRANSFUSION';
      await bloodRequest.save();

      await Transfusion.create({
        patient: bloodRequest.patient._id,
        doctor: req.user._id,
        bloodRequest: bloodRequest._id,
        transfusionDate: bloodRequest.transfusionDate,
        bloodGroup: bloodRequest.requiredBloodGroup,
        quantity: bloodRequest.requiredQuantity,
        source: bloodRequest.source || 'BLOOD_BANK',
        status: 'APPROVED',
        notes: doctorNotes
      });

      if (bloodRequest.patient?.userId) {
        await createNotification({
          recipientId: bloodRequest.patient.userId,
          type: 'BLOOD_AVAILABLE',
          title: 'Doctor Approved Transfusion!',
          message: `Dr. ${req.user.name} has approved your transfusion for ${new Date(bloodRequest.transfusionDate).toLocaleDateString()}.`,
          relatedEntity: { entityType: 'BloodRequest', entityId: bloodRequest._id }
        });
      }
    } else {
      bloodRequest.doctorApprovalStatus = 'REJECTED';
      bloodRequest.doctorApprovalDate = new Date();
      bloodRequest.doctorNotes = doctorNotes || 'Doctor declined transfusion approval.';
      bloodRequest.currentStatus = 'CANCELLED';
      await bloodRequest.save();

      if (bloodRequest.patient?.userId) {
        await createNotification({
          recipientId: bloodRequest.patient.userId,
          type: 'BLOOD_UNAVAILABLE',
          title: 'Transfusion Request Declined',
          message: `Your transfusion request for ${new Date(bloodRequest.transfusionDate).toLocaleDateString()} was declined.`,
          relatedEntity: { entityType: 'BloodRequest', entityId: bloodRequest._id }
        });
      }
    }

    res.status(200).json({ success: true, message: `Transfusion request ${action.toLowerCase()}d`, data: bloodRequest });
  } catch (error) {
    next(error);
  }
};



// @desc    Complete transfusion procedure & recalculate next transfusion date
// @route   POST /api/doctors/complete-transfusion
// @access  Private (Doctor)
const completeTransfusion = async (req, res, next) => {
  try {
    const { bloodRequestId, completionNotes } = req.body;

    const bloodRequest = await BloodRequest.findById(bloodRequestId).populate('patient');
    if (!bloodRequest) {
      return res.status(404).json({ success: false, message: 'Blood request not found' });
    }

    // RBAC Check
    if (req.user.role === 'DOCTOR' && bloodRequest.patient?.assignedDoctor?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized. Only assigned doctor can complete transfusion.' });
    }

    bloodRequest.currentStatus = 'COMPLETED';
    await bloodRequest.save();

    // Deduct reserved units from BloodInventory if sourced from Blood Bank
    if (bloodRequest.reservedInventoryId) {
      const inventoryItem = await BloodInventory.findById(bloodRequest.reservedInventoryId);
      if (inventoryItem) {
        inventoryItem.reservedQuantity = Math.max(0, inventoryItem.reservedQuantity - bloodRequest.requiredQuantity);
        inventoryItem.quantity = Math.max(0, inventoryItem.quantity - bloodRequest.requiredQuantity);
        if (inventoryItem.quantity === 0) {
          inventoryItem.status = 'RESERVED';
        }
        await inventoryItem.save();
      }
    }

    // Update Transfusion record
    let transfusion = await Transfusion.findOne({ bloodRequest: bloodRequest._id });
    if (transfusion) {
      transfusion.status = 'COMPLETED';
      transfusion.completedAt = new Date();
      transfusion.notes = completionNotes || 'Transfusion completed successfully.';
      await transfusion.save();
    }

    // Update Patient records & recalculate next transfusion date
    const patient = await Patient.findById(bloodRequest.patient._id);
    if (patient) {
      patient.lastTransfusionDate = new Date();
      patient.nextTransfusionDate = calculateNextTransfusionDate(
        patient.lastTransfusionDate,
        patient.transfusionFrequency || 21
      );
      await patient.save();

      // Notify Patient
      if (patient.userId) {
        await createNotification({
          recipientId: patient.userId,
          type: 'TRANSFUSION_REMINDER',
          title: 'Transfusion Completed',
          message: `Your transfusion was completed. Your next predicted transfusion date is ${new Date(patient.nextTransfusionDate).toLocaleDateString()}.`,
          relatedEntity: { entityType: 'Patient', entityId: patient._id }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Transfusion completed and next date automatically predicted!',
      data: { bloodRequest, patient }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAssignedPatients,
  getPendingApprovals,
  approveTransfusion,
  confirmBloodSecured,
  completeTransfusion
};
