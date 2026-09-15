const express = require('express');
const router = express.Router();
const {
  getInventory,
  addInventory,
  updateInventory,
  removeInventory,
  removeExpiredUnits
} = require('../controllers/bloodBankController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.use(protect);

router.get('/inventory', getInventory);
router.post('/inventory', authorize('BLOOD_BANK', 'ADMIN'), addInventory);
router.put('/inventory/:id', authorize('BLOOD_BANK', 'ADMIN'), updateInventory);
router.delete('/inventory/:id', authorize('BLOOD_BANK', 'ADMIN'), removeInventory);
router.post('/inventory/purge-expired', authorize('BLOOD_BANK', 'ADMIN'), removeExpiredUnits);

module.exports = router;
