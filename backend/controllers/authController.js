const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Donor = require('../models/Donor');
const { generateToken } = require('../utils/jwt');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, address, extraInfo } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userRole = role || 'PATIENT';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      phone,
      address
    });

    // Create linked profile based on role
    if (userRole === 'DOCTOR') {
      await Doctor.create({
        userId: user._id,
        name: user.name,
        specialization: extraInfo?.specialization || 'Hematologist',
        hospital: extraInfo?.hospital || 'City Central Hospital',
        contactNumber: phone || '+91-9876543210',
        email: user.email
      });
    } else if (userRole === 'PATIENT') {
      const lastTrans = extraInfo?.lastTransfusionDate ? new Date(extraInfo.lastTransfusionDate) : new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
      const freq = parseInt(extraInfo?.transfusionFrequency, 10) || 21;
      const { calculateNextTransfusionDate } = require('../utils/dateUtils');
      const nextTrans = calculateNextTransfusionDate(lastTrans, freq);

      const newPatient = await Patient.create({
        userId: user._id,
        name: user.name,
        dateOfBirth: extraInfo?.dateOfBirth ? new Date(extraInfo.dateOfBirth) : new Date('2000-01-01'),
        gender: extraInfo?.gender || 'MALE',
        phone: phone || user.phone || '+91-9876543210',
        email: user.email,
        address: address || user.address || 'City Center',
        bloodGroup: extraInfo?.bloodGroup || 'B+',
        diagnosis: extraInfo?.diagnosis || 'Thalassemia Major',
        transfusionFrequency: freq,
        lastTransfusionDate: lastTrans,
        nextTransfusionDate: nextTrans,
        hospital: extraInfo?.hospital || 'City Central Hospital'
      });

      // Dynamically assign doctor with lowest workload
      const { assignDoctorToPatient } = require('../services/doctorAssignmentService');
      await assignDoctorToPatient(newPatient._id);
    } else if (userRole === 'DONOR') {
      const newDonor = await Donor.create({
        userId: user._id,
        name: user.name,
        email: user.email,
        phone: phone || '+91-9876543210',
        bloodGroup: extraInfo?.bloodGroup || 'B+',
        location: address || 'City Center',
        availabilityStatus: 'AVAILABLE',
        willingToDonate: extraInfo?.willingToDonate !== false,
        verificationStatus: 'ELIGIBLE'
      });

      // EVENT-DRIVEN MATCH: Automatically evaluate and notify for matching ACTIVE blood requirements
      try {
        const { checkAndMatchNewDonor } = require('../services/bloodSearchService');
        await checkAndMatchNewDonor(newDonor);
      } catch (matchErr) {
        console.error('Error during auto donor matching on registration:', matchErr);
      }
    }

    const token = generateToken({ id: user._id, role: user.role });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken({ id: user._id, role: user.role });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          address: user.address
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let linkedProfile = null;

    if (user.role === 'PATIENT') {
      linkedProfile = await Patient.findOne({ userId: user._id }).populate('assignedDoctor');
    } else if (user.role === 'DOCTOR') {
      linkedProfile = await Doctor.findOne({ userId: user._id });
    } else if (user.role === 'DONOR') {
      linkedProfile = await Donor.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        linkedProfile
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe
};
