const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { validate } = require('../../middlewares/validation.middleware');
const { authMiddleware, optionalAuth } = require('../../middlewares/auth.middleware');
const reviewController = require('./review.controller');

const aspect = (name) => body(`aspects.${name}`).optional().isInt({ min: 1, max: 5 });

router.get(
  '/locality',
  optionalAuth,
  [query('city').notEmpty(), query('locality').notEmpty(), query('limit').optional().isInt({ min: 1, max: 50 }), validate],
  reviewController.getLocality,
);

router.post(
  '/locality',
  authMiddleware,
  [
    body('city').isString().notEmpty(),
    body('locality').isString().notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1–5'),
    aspect('connectivity'),
    aspect('safety'),
    aspect('amenities'),
    aspect('cleanliness'),
    body('likes').optional().isString().isLength({ max: 600 }),
    body('dislikes').optional().isString().isLength({ max: 600 }),
    body('relation').optional().isIn(['resident', 'tenant', 'owner', 'visitor']),
    validate,
  ],
  reviewController.upsertLocality,
);

module.exports = router;
