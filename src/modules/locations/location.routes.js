const express = require('express');
const router = express.Router();
const controller = require('./location.controller');

router.get('/popular-cities', controller.getPopularCities);
router.get('/cities/:city', controller.getCityDetails);

module.exports = router;
