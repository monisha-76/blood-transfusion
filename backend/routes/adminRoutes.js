const express = require('express');
const router = express.Router();
const {
  getSystemStats,
  getAllUsers,
  getDoctorWorkload,
  updateUserRole
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorize('ADMIN', 'HOSPITAL_MANAGEMENT'));

router.get('/stats', getSystemStats);
router.get('/users', authorize('ADMIN'), getAllUsers);
router.get('/doctor-workload', authorize('ADMIN'), getDoctorWorkload);
router.put('/users/:id/role', authorize('ADMIN'), updateUserRole);

module.exports = router;
