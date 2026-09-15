const express = require('express');
const router = express.Router();
const {
  getMyNotifications,
  markAsRead
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getMyNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
