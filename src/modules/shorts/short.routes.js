const express = require('express');
const router = express.Router();
const controller = require('./short.controller');
const { authMiddleware } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');

const { uploadVideos } = require('../../middlewares/upload.middleware');

router.get('/feed', controller.feed);
router.get('/:id', controller.getById);
router.post('/:id/view', controller.view);
router.post('/:id/share', controller.share);

router.use(authMiddleware);
router.get('/my-shorts', controller.myShorts);
router.post('/', uploadVideos.single('video'), controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/like', controller.like);
router.delete('/:id/like', controller.unlike);

module.exports = router;
