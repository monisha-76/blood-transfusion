const express = require('express');
const router = express.Router();
const {
  getAllRequests,
  getRequestById,
  createRequest,
  triggerProcurementSearch,
  getEscalatedCases
} = require('../controllers/bloodRequestController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/', getAllRequests);
router.get('/escalated', authorize('HOSPITAL_MANAGEMENT', 'ADMIN'), getEscalatedCases);
router.get('/:id', getRequestById);
router.post('/', createRequest);
router.post('/:id/search', triggerProcurementSearch);

module.exports = router;
