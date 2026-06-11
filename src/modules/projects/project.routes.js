const express = require('express');
const router = express.Router();
const controller = require('./project.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

router.get('/recommended', controller.getRecommended);
router.get('/popular', controller.getPopular);
router.get('/search', controller.search);
router.get('/:id/properties', controller.getProjectProperties);
router.get('/:id', controller.getById);

router.use(authMiddleware);
router.post('/', authorize('builder', 'admin'), controller.create);
router.put('/:id', authorize('builder', 'admin'), controller.update);
router.delete('/:id', authorize('builder', 'admin'), controller.remove);

module.exports = router;
