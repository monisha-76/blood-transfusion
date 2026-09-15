const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Donor = require('../models/Donor');
const BloodInventory = require('../models/BloodInventory');
const BloodRequest = require('../models/BloodRequest');
const Transfusion = require('../models/Transfusion');
const { getDoctorWorkloadSummary } = require('../services/doctorAssignmentService');

// @desc    Get dashboard statistics for Admin
// @route   GET /api/admin/stats
// @access  Private (Admin, Hospital Mgmt)
const getSystemStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPatients = await Patient.countDocuments();
    const totalDoctors = await Doctor.countDocuments();
    const totalDonors = await Donor.countDocuments();
    const activeRequests = await BloodRequest.countDocuments({ currentStatus: { $ne: 'COMPLETED' } });
    const completedTransfusions = await Transfusion.countDocuments({ status: 'COMPLETED' });
    const escalatedCases = await BloodRequest.countDocuments({ currentStatus: 'UNAVAILABLE_ESCALATED' });

    const pendingApprovals = await BloodRequest.countDocuments({ currentStatus: 'PENDING' });
    const approvedRequests = await BloodRequest.countDocuments({ currentStatus: { $in: ['APPROVED', 'READY_FOR_TRANSFUSION'] } });
    const rejectedRequests = await BloodRequest.countDocuments({ currentStatus: 'CANCELLED' });

    // Blood stock by group
    const inventoryStock = await BloodInventory.aggregate([
      { $match: { status: 'AVAILABLE' } },
      { $group: { _id: '$bloodGroup', totalQuantity: { $sum: '$quantity' }, reserved: { $sum: '$reservedQuantity' } } }
    ]);

    const doctorWorkload = await getDoctorWorkloadSummary();

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalPatients,
        totalDoctors,
        totalDonors,
        activeRequests,
        completedTransfusions,
        escalatedCases,
        pendingApprovals,
        approvedRequests,
        rejectedRequests,
        inventoryStock,
        doctorWorkload
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all registered users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Get doctor workload and patient counts
// @route   GET /api/admin/doctor-workload
// @access  Private (Admin)
const getDoctorWorkload = async (req, res, next) => {
  try {
    const workload = await getDoctorWorkloadSummary();
    res.status(200).json({ success: true, data: workload });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user role or active status
// @route   PUT /api/admin/users/:id/role
// @access  Private (Admin)
const updateUserRole = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  getDoctorWorkload,
  updateUserRole
};
