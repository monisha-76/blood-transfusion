const Patient = require('../models/Patient');
const BloodRequest = require('../models/BloodRequest');
const { getDifferenceInDays } = require('../utils/dateUtils');
const { initiateBloodSearch } = require('./bloodSearchService');

/**
 * Checks all patients and triggers blood search ONLY when predicted transfusion date
 * is within the next 10 days from currentDate (daysUntilTransfusion >= 0 && daysUntilTransfusion <= 10).
 * Prevents duplicates by verifying that no active (non-cancelled, non-completed) BloodRequest
 * already exists for this upcoming transfusion cycle.
 */
const trigger10DayBloodSearch = async () => {
  try {
    const patients = await Patient.find();
    const today = new Date();

    for (const patient of patients) {
      if (!patient.nextTransfusionDate) continue;

      const daysUntilTransfusion = getDifferenceInDays(today, patient.nextTransfusionDate);

      // Blood search trigger rule:
      // daysUntilTransfusion >= 0 AND daysUntilTransfusion <= 10
      if (daysUntilTransfusion >= 0 && daysUntilTransfusion <= 10) {
        // Prevent duplicate BloodRequests:
        // Check whether an active BloodRequest already exists for this patient's upcoming transfusion cycle
        const existingActiveRequest = await BloodRequest.findOne({
          patient: patient._id,
          $or: [
            { transfusionDate: patient.nextTransfusionDate },
            { currentStatus: { $in: ['PENDING', 'INVENTORY_CHECK', 'DONOR_SEARCH', 'DONOR_NOTIFICATION', 'PUBLIC_RECRUITMENT', 'BLOOD_AVAILABLE', 'READY_FOR_TRANSFUSION', 'UNAVAILABLE_ESCALATED'] } }
          ],
          currentStatus: { $nin: ['COMPLETED', 'CANCELLED'] }
        });

        if (existingActiveRequest) {
          // An active request already exists for this cycle - do NOT create another
          continue;
        }

        const transfusionDate = new Date(patient.nextTransfusionDate);
        const searchStartDate = new Date(today);
        const searchEndDate = new Date(transfusionDate);

        const bloodRequest = await BloodRequest.create({
          patient: patient._id,
          doctor: patient.assignedDoctor,
          hospital: patient.hospital || 'City Central Hospital',
          requiredBloodGroup: patient.bloodGroup,
          requiredQuantity: 1,
          transfusionDate,
          searchStartDate,
          searchEndDate,
          currentStatus: 'PENDING',
          doctorApprovalStatus: 'PENDING'
        });

        console.log(`[10-DAY TRIGGER] Created BloodRequest #${bloodRequest._id} for Patient '${patient.name}' (${patient.bloodGroup}) due in ${daysUntilTransfusion} day(s).`);

        // Initiate 4-Level procurement pipeline
        await initiateBloodSearch(bloodRequest._id);
      }
    }
  } catch (error) {
    console.error('Error triggering 10-day blood search:', error);
  }
};

module.exports = {
  trigger10DayBloodSearch
};
