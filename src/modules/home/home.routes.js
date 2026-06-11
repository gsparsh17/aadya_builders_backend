const express = require('express');
const router = express.Router();
const controller = require('./home.controller');
const { optionalAuth } = require('../../middlewares/auth.middleware');

router.get('/', optionalAuth, controller.getHome);
router.get('/offerings', controller.getOfferings);

module.exports = router;
