const mongoose = require('mongoose');
const Donor = require('../models/Donor');
const BloodRequest = require('../models/BloodRequest');
const DonorMatch = require('../models/DonorMatch');
const { processDonorResponse, checkAndMatchNewDonor, confirmBloodSecured } = require('../services/bloodSearchService');
const { BLOOD_COMPATIBILITY_MATRIX } = require('../services/bloodMatchingService');

// @desc    Get donor profile
// @route   GET /api/donors/me
// @access  Private (Donor)
const getDonorProfile = async (req, res, next) => {
  try {
    let donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) {
      // Auto create default donor profile if missing
      donor = await Donor.create({
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone || '+91-9876543210',
        bloodGroup: 'B+',
        location: req.user.address || 'City Center',
        willingToDonate: true,
        availabilityStatus: 'AVAILABLE'
      });
    }
    res.status(200).json({ success: true, data: donor });
  } catch (error) {
    next(error);
  }
};

// @desc    Update donor availability & profile
// @route   PUT /api/donors/me
// @access  Private (Donor)
const updateDonorProfile = async (req, res, next) => {
  try {
    const { bloodGroup, location, availabilityStatus, lastDonationDate, willingToDonate } = req.body;
    let donor = await Donor.findOne({ userId: req.user._id });

    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    if (bloodGroup) donor.bloodGroup = bloodGroup;
    if (location) donor.location = location;
    if (availabilityStatus) donor.availabilityStatus = availabilityStatus;
    if (willingToDonate !== undefined) donor.willingToDonate = willingToDonate;
    if (lastDonationDate) donor.lastDonationDate = new Date(lastDonationDate);

    await donor.save();

    // If donor is active and willing, check if any active requests match
    if (donor.willingToDonate && donor.availabilityStatus === 'AVAILABLE') {
      await checkAndMatchNewDonor(donor);
    }

    res.status(200).json({
      success: true,
      message: 'Donor profile updated successfully',
      data: donor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending donation requests matching donor's blood group
// @route   GET /api/donors/requests
// @access  Private (Donor)
const getPendingRequests = async (req, res, next) => {
  try {
    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Find active blood requests needing blood
    const activeRequests = await BloodRequest.find({
      currentStatus: { $in: ['ACTIVE', 'PENDING', 'INVENTORY_CHECK', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'UNAVAILABLE_ESCALATED'] },
      remainingQuantity: { $gt: 0 }
    }).populate({
      path: 'patient',
      select: 'name phone email address hospital diagnosis patientCondition requiredComponent'
    });

    // Filter requests matching donor's blood group compatibility
    const matchingRequests = activeRequests.filter(reqItem => {
      // Check if donor already responded (ACCEPTED or REJECTED)
      const existingResp = reqItem.donorResponses?.find(
        dr => dr.donorId && dr.donorId.toString() === donor._id.toString()
      );
      if (existingResp && (existingResp.status === 'ACCEPTED' || existingResp.status === 'REJECTED')) {
        return false; // Hide already responded requests
      }

      // Donor's blood group compatibility
      const compatibleRecipients = BLOOD_COMPATIBILITY_MATRIX[donor.bloodGroup] || [donor.bloodGroup];
      const isBloodCompatible = compatibleRecipients.includes(reqItem.requiredBloodGroup) || reqItem.requiredBloodGroup === donor.bloodGroup;

      const isExplicitlyNotified = reqItem.donorResponses?.some(
        dr => dr.donorId && dr.donorId.toString() === donor._id.toString()
      );

      return isBloodCompatible || isExplicitlyNotified;
    });

    res.status(200).json({
      success: true,
      count: matchingRequests.length,
      data: matchingRequests
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept or Reject donation request
// @route   POST /api/donors/respond
// @access  Private (Donor)
const respondToRequest = async (req, res, next) => {
  try {
    const { bloodRequestId, action } = req.body; // action: 'ACCEPTED' or 'REJECTED'

    if (!bloodRequestId || !['ACCEPTED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Provide bloodRequestId and valid action (ACCEPTED/REJECTED)' });
    }

    const donor = await Donor.findOne({ userId: req.user._id });
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor record not found' });
    }

    const updatedRequest = await processDonorResponse(bloodRequestId, donor._id, action);

    res.status(200).json({
      success: true,
      message: action === 'ACCEPTED' 
        ? 'Thank you! You have confirmed your willingness to donate. The hospital and patient care team have been notified.' 
        : 'Request marked as Not Ready.',
      data: updatedRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Public Donor Registration Page Intake Endpoint
// @route   POST /api/donors/public-register
// @access  Public
const publicDonorRegister = async (req, res, next) => {
  try {
    const { name, dateOfBirth, bloodGroup, phone, email, location, availabilityStatus, lastDonationDate, healthDeclaration, consent, willingToDonate } = req.body;

    if (!name || !bloodGroup || !phone || !email || !location) {
      return res.status(400).json({ success: false, message: 'Please fill in all required fields' });
    }

    let donor = await Donor.create({
      name,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      bloodGroup,
      phone,
      email,
      location,
      availabilityStatus: availabilityStatus || 'AVAILABLE',
      willingToDonate: willingToDonate !== false,
      lastDonationDate: lastDonationDate ? new Date(lastDonationDate) : undefined,
      verificationStatus: 'ELIGIBLE',
      healthDeclaration: healthDeclaration !== false,
      consent: consent !== false
    });

    // EVENT-DRIVEN MATCH: Automatically evaluate and notify for matching ACTIVE blood requirements
    try {
      if (donor.willingToDonate && donor.availabilityStatus === 'AVAILABLE') {
        const matchResult = await checkAndMatchNewDonor(donor);
        console.log(`[PUBLIC DONOR REGISTRATION] Registered ${donor.name} (${donor.bloodGroup}). Matched active requests: ${matchResult.matchedRequests}`);
      }
    } catch (searchErr) {
      console.error('Background donor matching error:', searchErr);
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for registering as a voluntary blood donor! Your details have been recorded.',
      data: donor
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all donors
// @route   GET /api/donors
// @access  Private (Admin, Hospital Mgmt)
const getAllDonors = async (req, res, next) => {
  try {
    const donors = await Donor.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: donors.length, data: donors });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify donor email link token
// @route   GET /api/donors/verify-link
// @access  Public
const verifyDonorLink = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Missing token' });
    }
    const { verifyToken } = require('../utils/jwt');
    const decoded = verifyToken(token);
    res.status(200).json({
      success: true,
      data: {
        bloodRequestId: decoded.bloodRequestId,
        donorId: decoded.donorId,
        email: decoded.email
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired donation link token' });
  }
};

// @desc    Confirm received blood donation and increment securedQuantity
// @route   POST /api/donors/confirm-donation
// @access  Private (Doctor, Hospital Mgmt, Admin)
const confirmDonation = async (req, res, next) => {
  try {
    const { bloodRequestId, unitsSecured } = req.body;
    if (!bloodRequestId) {
      return res.status(400).json({ success: false, message: 'bloodRequestId is required' });
    }

    const updatedRequest = await confirmBloodSecured(bloodRequestId, unitsSecured || 1, 'REGISTERED_DONOR');

    res.status(200).json({
      success: true,
      message: `Donation confirmed. ${unitsSecured || 1} unit(s) secured. Status: ${updatedRequest.currentStatus}`,
      data: updatedRequest
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDonorProfile,
  updateDonorProfile,
  getPendingRequests,
  respondToRequest,
  publicDonorRegister,
  getAllDonors,
  verifyDonorLink,
  confirmDonation
};
