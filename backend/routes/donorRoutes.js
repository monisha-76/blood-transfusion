const express = require('express');
const router = express.Router();
const {
  getDonorProfile,
  updateDonorProfile,
  getPendingRequests,
  respondToRequest,
  publicDonorRegister,
  getAllDonors,
  verifyDonorLink,
  confirmDonation
} = require('../controllers/donorController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Public route for guest public donor registration intake
router.post('/public-register', publicDonorRegister);

// Public route for email link verification
router.get('/verify-link', verifyDonorLink);

// Protected routes
router.use(protect);
router.get('/me', getDonorProfile);
router.put('/me', updateDonorProfile);
router.get('/requests', getPendingRequests);
router.post('/respond', respondToRequest);
router.post('/confirm-donation', authorize('DOCTOR', 'HOSPITAL_MANAGEMENT', 'ADMIN'), confirmDonation);
router.get('/', authorize('ADMIN', 'HOSPITAL_MANAGEMENT'), getAllDonors);

module.exports = router;
