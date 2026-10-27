const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');
const catalogController = require('./catalog.controller');

/**
 * @route   GET /api/v1/catalog
 * @desc    Segments, property types, filter options and live counts
 * @access  Public
 */
router.get('/', [query('city').optional().isString(), validate], catalogController.getCatalog);

module.exports = router;
