const express = require('express');
const router = express.Router();
const {
  getAssignedPatients,
  getPendingApprovals,
  approveTransfusion,
  completeTransfusion,
  confirmBloodSecured
} = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(authorize('DOCTOR', 'ADMIN'));

router.get('/patients', getAssignedPatients);
router.get('/approvals', getPendingApprovals);
router.post('/approve-transfusion', approveTransfusion);
router.post('/confirm-blood-secured', confirmBloodSecured);
router.post('/complete-transfusion', completeTransfusion);

module.exports = router;
