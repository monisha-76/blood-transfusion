const BloodInventory = require('../models/BloodInventory');
const { checkLateBloodAvailability } = require('../services/bloodSearchService');

// @desc    Get all blood inventory units
// @route   GET /api/blood-bank/inventory
// @access  Private
const getInventory = async (req, res, next) => {
  try {
    const inventory = await BloodInventory.find().sort({ expiryDate: 1 });
    res.status(200).json({
      success: true,
      count: inventory.length,
      data: inventory
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add blood inventory batch
// @route   POST /api/blood-bank/inventory
// @access  Private (Blood Bank, Admin)
const addInventory = async (req, res, next) => {
  try {
    const { bloodBank, bloodGroup, component, quantity, expiryDate } = req.body;

    if (!bloodGroup || !quantity || !expiryDate) {
      return res.status(400).json({ success: false, message: 'Please provide bloodGroup, quantity, and expiryDate' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
    }

    const item = await BloodInventory.create({
      bloodBank: bloodBank || 'City Central Blood Bank',
      bloodGroup,
      component: component || 'PRBC',
      quantity,
      expiryDate: new Date(expiryDate),
      status: 'AVAILABLE'
    });

    // Check if new inventory fulfills any escalated/pending requests (Late availability detection!)
    await checkLateBloodAvailability();

    res.status(201).json({
      success: true,
      message: 'Blood inventory added successfully',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update blood inventory item
// @route   PUT /api/blood-bank/inventory/:id
// @access  Private (Blood Bank, Admin)
const updateInventory = async (req, res, next) => {
  try {
    const { quantity, reservedQuantity, status, expiryDate } = req.body;
    const item = await BloodInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (quantity !== undefined) {
      if (quantity < 0) return res.status(400).json({ success: false, message: 'Quantity cannot be negative' });
      item.quantity = quantity;
    }

    if (reservedQuantity !== undefined) {
      if (reservedQuantity < 0) return res.status(400).json({ success: false, message: 'Reserved quantity cannot be negative' });
      item.reservedQuantity = reservedQuantity;
    }

    if (status) item.status = status;
    if (expiryDate) item.expiryDate = new Date(expiryDate);

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Inventory updated',
      data: item
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete blood inventory item
// @route   DELETE /api/blood-bank/inventory/:id
// @access  Private (Blood Bank, Admin)
const removeInventory = async (req, res, next) => {
  try {
    const item = await BloodInventory.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    res.status(200).json({ success: true, message: 'Inventory item removed' });
  } catch (error) {
    next(error);
  }
};

// @desc    Purge expired blood units
// @route   POST /api/blood-bank/inventory/purge-expired
// @access  Private (Blood Bank, Admin)
const removeExpiredUnits = async (req, res, next) => {
  try {
    const result = await BloodInventory.updateMany(
      { expiryDate: { $lt: new Date() }, status: 'AVAILABLE' },
      { status: 'EXPIRED' }
    );
    res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} expired units`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  addInventory,
  updateInventory,
  removeInventory,
  removeExpiredUnits
};
