const Transfusion = require('../models/Transfusion');

// @desc    Get all transfusions
// @route   GET /api/transfusions
// @access  Private
const getAllTransfusions = async (req, res, next) => {
  try {
    const transfusions = await Transfusion.find()
      .populate('patient')
      .populate('doctor', 'name email')
      .sort({ transfusionDate: -1 });

    res.status(200).json({
      success: true,
      count: transfusions.length,
      data: transfusions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get transfusion by ID
// @route   GET /api/transfusions/:id
// @access  Private
const getTransfusionById = async (req, res, next) => {
  try {
    const transfusion = await Transfusion.findById(req.params.id)
      .populate('patient')
      .populate('doctor');

    if (!transfusion) {
      return res.status(404).json({ success: false, message: 'Transfusion record not found' });
    }

    res.status(200).json({ success: true, data: transfusion });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTransfusions,
  getTransfusionById
};
