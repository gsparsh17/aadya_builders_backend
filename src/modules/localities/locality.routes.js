const express = require('express');
const router = express.Router();
const controller = require('./locality.controller');

router.get('/recommended', controller.getRecommended);
router.get('/:city/:locality/properties', controller.getProperties);
router.get('/:city/:locality/insights', controller.getInsights);
router.get('/:city/:locality', controller.getDetails);

module.exports = router;
