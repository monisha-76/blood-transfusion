const User = require('../models/User');
const Patient = require('../models/Patient');
const { createNotification } = require('./notificationService');

/**
 * Dynamic Workload-Based Doctor Assignment Service
 * Assigns a new patient to the active doctor with the lowest current patient load.
 * @param {string|ObjectId} patientId 
 * @returns {Promise<Object|null>} Assigned Doctor User Document
 */
const assignDoctorToPatient = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId);
    if (!patient) return null;

    // 1. Fetch all active doctors in system
    const doctorUsers = await User.find({ role: 'DOCTOR', isActive: true });
    if (!doctorUsers || doctorUsers.length === 0) {
      console.log('[DOCTOR ASSIGNMENT] Warning: No active doctors available in system.');
      return null;
    }

    // 2. Count current assigned patients for each doctor
    const doctorLoadList = await Promise.all(
      doctorUsers.map(async (docUser) => {
        const count = await Patient.countDocuments({ assignedDoctor: docUser._id });
        return {
          doctorUser: docUser,
          count
        };
      })
    );

    // 3. Sort by lowest count (tie-breaker: doctor _id ascending for consistency)
    doctorLoadList.sort((a, b) => {
      if (a.count !== b.count) {
        return a.count - b.count; // Lowest load first
      }
      return a.doctorUser._id.toString().localeCompare(b.doctorUser._id.toString());
    });

    const selectedDoctorUser = doctorLoadList[0].doctorUser;
    const previousDoctorId = patient.assignedDoctor ? patient.assignedDoctor.toString() : null;

    // 4. Update patient's assigned doctor in DB
    patient.assignedDoctor = selectedDoctorUser._id;
    await patient.save();

    // 5. Notify ONLY the assigned doctor if assignment is new or changed
    if (previousDoctorId !== selectedDoctorUser._id.toString()) {
      await createNotification({
        recipientId: selectedDoctorUser._id,
        type: 'BLOOD_REQUEST',
        title: 'New Patient Assigned',
        message: `Patient ${patient.name} (Blood Group: ${patient.bloodGroup}) has been assigned to your care.`,
        relatedEntity: { entityType: 'Patient', entityId: patient._id }
      });
    }

    console.log(`[DYNAMIC DOCTOR ASSIGNMENT] Patient '${patient.name}' assigned to Dr. ${selectedDoctorUser.name} (Current Load: ${doctorLoadList[0].count + 1} patients)`);

    return selectedDoctorUser;
  } catch (error) {
    console.error('Error in assignDoctorToPatient:', error);
    return null;
  }
};

/**
 * Gets workload metrics (patient count per doctor) for all doctors
 */
const getDoctorWorkloadSummary = async () => {
  try {
    const doctorUsers = await User.find({ role: 'DOCTOR' }).select('name email phone specialization hospital');
    
    const summary = await Promise.all(
      doctorUsers.map(async (doc) => {
        const patientCount = await Patient.countDocuments({ assignedDoctor: doc._id });
        const assignedPatients = await Patient.find({ assignedDoctor: doc._id }).select('name bloodGroup diagnosis nextTransfusionDate');
        return {
          doctorId: doc._id,
          name: doc.name,
          email: doc.email,
          phone: doc.phone,
          patientCount,
          assignedPatients
        };
      })
    );

    return summary;
  } catch (error) {
    console.error('Error in getDoctorWorkloadSummary:', error);
    return [];
  }
};

module.exports = {
  assignDoctorToPatient,
  getDoctorWorkloadSummary
};
