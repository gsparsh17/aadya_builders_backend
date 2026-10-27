const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const reportController = require('./report.controller');

const REASONS = ['fraud', 'already_sold', 'wrong_details', 'wrong_price', 'duplicate', 'broker_as_owner', 'other'];

router.use(authMiddleware);

router.post(
  '/',
  [
    body('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('reason').isIn(REASONS).withMessage('Invalid reason'),
    body('details').optional().isString().isLength({ max: 500 }),
    validate,
  ],
  reportController.create,
);

router.get(
  '/admin',
  authorize('admin'),
  [query('status').optional().isIn(['open', 'reviewing', 'resolved', 'dismissed']), validate],
  reportController.adminList,
);

router.put(
  '/admin/:id',
  authorize('admin'),
  [
    param('id').isMongoId(),
    body('status').isIn(['reviewing', 'resolved', 'dismissed']),
    body('resolution').optional().isString(),
    body('deactivateListing').optional().isBoolean(),
    validate,
  ],
  reportController.adminUpdate,
);

module.exports = router;
