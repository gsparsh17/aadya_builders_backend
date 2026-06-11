const express = require('express');
const router = express.Router();
const controller = require('./builder.controller');

router.get('/popular', controller.getPopular);
router.get('/:id/projects', controller.getProjects);
router.get('/:id/properties', controller.getProperties);
router.get('/:id', controller.getById);

module.exports = router;
