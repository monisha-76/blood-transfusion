const express = require('express');
const router = express.Router();
const {
  getAllTransfusions,
  getTransfusionById
} = require('../controllers/transfusionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getAllTransfusions);
router.get('/:id', getTransfusionById);

module.exports = router;
