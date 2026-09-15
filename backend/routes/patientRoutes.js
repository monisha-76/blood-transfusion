const express = require('express');
const router = express.Router();
const {
  createPatientProfile,
  getMyPatientProfile,
  updatePatientMedicalRecords,
  getAllPatients,
  getPatientById
} = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.post('/', createPatientProfile);
router.get('/me', getMyPatientProfile);
router.put('/:id/medical-records', authorize('DOCTOR', 'ADMIN'), updatePatientMedicalRecords);
router.get('/', authorize('DOCTOR', 'ADMIN', 'HOSPITAL_MANAGEMENT'), getAllPatients);
router.get('/:id', getPatientById);

module.exports = router;
