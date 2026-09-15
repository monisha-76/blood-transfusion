const Donor = require('../models/Donor');
const { isDonorEligible } = require('../utils/dateUtils');

/**
 * Blood Compatibility Matrix (Donor -> Recipient)
 * Key: Recipient Blood Group
 * Value: Array of compatible Donor Blood Groups
 */
const BLOOD_COMPATIBILITY_MATRIX = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};

/**
 * Find matching eligible registered donors for a blood request
 * @param {string} recipientBloodGroup 
 * @param {Array<string>} excludeDonorIds 
 * @param {string} locationFilter 
 * @returns {Promise<Array>} List of eligible donors
 */
const findMatchingDonors = async (recipientBloodGroup, excludeDonorIds = [], locationFilter = null) => {
  try {
    const compatibleGroups = BLOOD_COMPATIBILITY_MATRIX[recipientBloodGroup] || [recipientBloodGroup];

    const query = {
      bloodGroup: { $in: compatibleGroups },
      availabilityStatus: 'AVAILABLE',
      verificationStatus: { $in: ['ELIGIBLE', 'ACTIVE'] },
      _id: { $nin: excludeDonorIds }
    };

    if (locationFilter) {
      query.location = new RegExp(locationFilter, 'i');
    }

    const potentialDonors = await Donor.find(query).populate('userId', 'name email phone');

    // Filter by donation interval eligibility (>= 90 days)
    const eligibleDonors = potentialDonors.filter(donor => {
      return isDonorEligible(donor.lastDonationDate, 90);
    });

    // Prioritize exact blood group match first, then by last donation date
    eligibleDonors.sort((a, b) => {
      if (a.bloodGroup === recipientBloodGroup && b.bloodGroup !== recipientBloodGroup) return -1;
      if (a.bloodGroup !== recipientBloodGroup && b.bloodGroup === recipientBloodGroup) return 1;
      return 0;
    });

    return eligibleDonors;
  } catch (error) {
    console.error('Error finding matching donors:', error);
    return [];
  }
};

module.exports = {
  BLOOD_COMPATIBILITY_MATRIX,
  findMatchingDonors
};
