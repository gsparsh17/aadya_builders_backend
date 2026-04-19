const express = require('express');
const router = express.Router();
const leadController = require('./lead.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { leadLimiter } = require('../../middlewares/rateLimiter');
const { body, param, query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');

// All routes require authentication
router.use(authMiddleware);

// ==================== Lead Creation ====================

/**
 * @route   POST /api/v1/leads
 * @desc    Create a new lead (contact owner)
 * @access  Private (Buyer/Tenant)
 */
router.post(
  '/',
  leadLimiter,
  [
    body('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),
    body('contactPreference').optional().isIn(['phone', 'email', 'whatsapp', 'any']).withMessage('Invalid contact preference'),
    body('preferredTimeToContact').optional().isIn(['morning', 'afternoon', 'evening', 'anytime']).withMessage('Invalid preferred time'),
    validate
  ],
  leadController.createLead
);

// ==================== Lead Retrieval ====================

/**
 * @route   GET /api/v1/leads
 * @desc    Get leads for current user (as owner)
 * @access  Private (Owner/Dealer/Builder)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['new', 'viewed', 'contacted', 'negotiating', 'site_visit_scheduled', 'site_visit_done', 'offer_made', 'closed_won', 'closed_lost', 'rejected', 'spam']),
    query('propertyId').optional().isMongoId().withMessage('Invalid property ID'),
    query('isSpam').optional().isBoolean().withMessage('isSpam must be a boolean'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    validate
  ],
  leadController.getMyLeads
);

/**
 * @route   GET /api/v1/leads/buyer
 * @desc    Get leads for current user (as buyer)
 * @access  Private
 */
router.get(
  '/buyer',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    validate
  ],
  leadController.getBuyerLeads
);

/**
 * @route   GET /api/v1/leads/stats
 * @desc    Get lead statistics for owner
 * @access  Private (Owner/Dealer/Builder)
 */
router.get(
  '/stats',
  [
    query('propertyId').optional().isMongoId().withMessage('Invalid property ID'),
    query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
    validate
  ],
  leadController.getLeadStats
);

/**
 * @route   GET /api/v1/leads/export
 * @desc    Export leads
 * @access  Private (Owner/Dealer/Builder)
 */
router.get(
  '/export',
  [
    query('format').optional().isIn(['csv', 'json']).withMessage('Invalid format'),
    query('status').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    validate
  ],
  leadController.exportLeads
);

/**
 * @route   GET /api/v1/leads/property/:propertyId
 * @desc    Get leads for a specific property
 * @access  Private (Property Owner)
 */
router.get(
  '/property/:propertyId',
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isString(),
    query('isSpam').optional().isBoolean(),
    validate
  ],
  leadController.getLeadsByProperty
);

/**
 * @route   GET /api/v1/leads/:id
 * @desc    Get lead by ID
 * @access  Private (Owner/Buyer)
 */
router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    validate
  ],
  leadController.getLeadById
);

// ==================== Lead Management ====================

/**
 * @route   PATCH /api/v1/leads/:id/status
 * @desc    Update lead status
 * @access  Private (Owner)
 */
router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('status').isIn(['viewed', 'contacted', 'negotiating', 'closed_won', 'closed_lost', 'rejected']).withMessage('Invalid status'),
    body('notes').optional().isString(),
    validate
  ],
  leadController.updateStatus
);

/**
 * @route   POST /api/v1/leads/:id/notes
 * @desc    Add note to lead
 * @access  Private (Owner/Buyer)
 */
router.post(
  '/:id/notes',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('text').notEmpty().withMessage('Note text is required').isString(),
    body('isPrivate').optional().isBoolean(),
    validate
  ],
  leadController.addNote
);

/**
 * @route   POST /api/v1/leads/:id/communications
 * @desc    Add communication record
 * @access  Private (Owner)
 */
router.post(
  '/:id/communications',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('type').isIn(['call', 'email', 'sms', 'whatsapp', 'site_visit', 'note']).withMessage('Invalid communication type'),
    body('direction').isIn(['incoming', 'outgoing']).withMessage('Invalid direction'),
    body('content').optional().isString(),
    body('duration').optional().isInt({ min: 0 }),
    body('outcome').optional().isString(),
    validate
  ],
  leadController.addCommunication
);

/**
 * @route   POST /api/v1/leads/:id/follow-up
 * @desc    Schedule follow-up
 * @access  Private (Owner)
 */
router.post(
  '/:id/follow-up',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('scheduledDate').isISO8601().withMessage('Invalid date format'),
    body('reminder').optional().isBoolean(),
    body('notes').optional().isString(),
    validate
  ],
  leadController.scheduleFollowUp
);

/**
 * @route   PATCH /api/v1/leads/:id/follow-up/complete
 * @desc    Complete follow-up
 * @access  Private (Owner)
 */
router.patch(
  '/:id/follow-up/complete',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('notes').optional().isString(),
    validate
  ],
  leadController.completeFollowUp
);

/**
 * @route   POST /api/v1/leads/:id/site-visit
 * @desc    Schedule site visit
 * @access  Private (Owner)
 */
router.post(
  '/:id/site-visit',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('scheduledDate').isISO8601().withMessage('Invalid date format'),
    body('notes').optional().isString(),
    validate
  ],
  leadController.scheduleSiteVisit
);

/**
 * @route   PATCH /api/v1/leads/:id/site-visit/complete
 * @desc    Complete site visit
 * @access  Private (Owner)
 */
router.patch(
  '/:id/site-visit/complete',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('feedback').optional().isString(),
    body('rating').optional().isInt({ min: 1, max: 5 }),
    validate
  ],
  leadController.completeSiteVisit
);

/**
 * @route   POST /api/v1/leads/:id/offer
 * @desc    Make an offer
 * @access  Private (Owner/Buyer)
 */
router.post(
  '/:id/offer',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid offer amount is required'),
    body('isNegotiable').optional().isBoolean(),
    body('notes').optional().isString(),
    validate
  ],
  leadController.makeOffer
);

/**
 * @route   PATCH /api/v1/leads/:id/offer/respond
 * @desc    Respond to offer
 * @access  Private (Owner/Buyer)
 */
router.patch(
  '/:id/offer/respond',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    body('status').isIn(['accepted', 'rejected', 'countered']).withMessage('Invalid status'),
    body('counterOffer').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    validate
  ],
  leadController.respondToOffer
);

/**
 * @route   PATCH /api/v1/leads/:id/spam
 * @desc    Mark lead as spam
 * @access  Private (Owner)
 */
router.patch(
  '/:id/spam',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    validate
  ],
  leadController.markAsSpam
);

/**
 * @route   PATCH /api/v1/leads/:id/unspam
 * @desc    Unmark lead as spam
 * @access  Private (Owner)
 */
router.patch(
  '/:id/unspam',
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    validate
  ],
  leadController.unmarkAsSpam
);

// ==================== Admin Routes ====================

/**
 * @route   GET /api/v1/leads/admin/all
 * @desc    Admin: Get all leads
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
    query('isSpam').optional().isBoolean(),
    validate
  ],
  leadController.adminGetAllLeads
);

/**
 * @route   GET /api/v1/leads/admin/stats
 * @desc    Admin: Get lead statistics
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authorize('admin'),
  leadController.adminGetLeadStats
);

/**
 * @route   DELETE /api/v1/leads/admin/:id
 * @desc    Admin: Delete lead
 * @access  Private/Admin
 */
router.delete(
  '/admin/:id',
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid lead ID'),
    validate
  ],
  leadController.adminDeleteLead
);

module.exports = router;