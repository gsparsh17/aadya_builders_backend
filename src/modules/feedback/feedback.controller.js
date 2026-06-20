const Feedback = require('./feedback.model');
const { successResponse } = require('../../utils/responseHandler');

class FeedbackController {
  async submitGeneralFeedback(req, res, next) {
    try {
      const feedback = await Feedback.create({
        user: req.user?._id,
        type: req.body.type || 'general',
        comment: req.body.message,
        metadata: {
          subject: req.body.subject,
          property: req.body.property
        }
      });
      return successResponse(res, feedback, 'Feedback submitted successfully', 201);
    } catch (error) { next(error); }
  }
  async helpful(req, res, next) {
    try {
      const feedback = await Feedback.create({
        user: req.user?._id,
        type: 'helpful',
        screen: req.body.screen,
        section: req.body.section,
        helpful: Boolean(req.body.helpful),
        metadata: req.body.metadata
      });
      return successResponse(res, feedback, 'Helpful feedback saved successfully', 201);
    } catch (error) { next(error); }
  }

  async appRating(req, res, next) {
    try {
      const feedback = await Feedback.create({
        user: req.user?._id,
        type: 'app_rating',
        screen: req.body.screen || 'app',
        rating: req.body.rating,
        comment: req.body.comment,
        metadata: req.body.metadata
      });
      return successResponse(res, feedback, 'App rating saved successfully', 201);
    } catch (error) { next(error); }
  }

  async localityRating(req, res, next) {
    try {
      const feedback = await Feedback.create({
        user: req.user?._id,
        type: 'locality_rating',
        city: req.body.city,
        locality: req.body.locality,
        rating: req.body.rating,
        comment: req.body.comment,
        metadata: req.body.metadata
      });
      return successResponse(res, feedback, 'Locality rating saved successfully', 201);
    } catch (error) { next(error); }
  }

  async societyRating(req, res, next) {
    try {
      const feedback = await Feedback.create({
        user: req.user?._id,
        type: 'society_rating',
        city: req.body.city,
        locality: req.body.locality,
        society: req.body.society,
        rating: req.body.rating,
        comment: req.body.comment,
        metadata: req.body.metadata
      });
      return successResponse(res, feedback, 'Society rating saved successfully', 201);
    } catch (error) { next(error); }
  }

  async myFeedback(req, res, next) {
    try {
      const data = await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 50);
      return successResponse(res, data, 'My feedback retrieved successfully');
    } catch (error) { next(error); }
  }
}

module.exports = new FeedbackController();
